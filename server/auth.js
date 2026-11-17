import crypto from 'crypto';

const AUTH_SECRET = process.env.AUTH_SECRET || 'sjv-eleccions-dev-secret-2027-change-in-prod';
if (process.env.NODE_ENV === 'production' && !process.env.AUTH_SECRET) {
  console.warn('[AVÍS] AUTH_SECRET no definit a l\'entorn; es recomana configurar AUTH_SECRET a Dokploy.');
}
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function base64UrlEncode(str) {
  return Buffer.from(str, 'utf8').toString('base64url');
}

function base64UrlDecode(str) {
  return Buffer.from(str, 'base64url').toString('utf8');
}

export function signToken(payload) {
  const now = Date.now();
  const body = {
    ...payload,
    iat: now,
    exp: now + TOKEN_TTL_MS
  };
  const encodedBody = base64UrlEncode(JSON.stringify(body));
  const signature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(encodedBody)
    .digest('base64url');
  return `${encodedBody}.${signature}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encodedBody, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(encodedBody)
    .digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedBody));
    if (!payload.exp || Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

export function optionalAuth(req, _res, next) {
  const token = extractToken(req);
  req.auth = token ? verifyToken(token) : null;
  next();
}

export function requireAuth(req, res, next) {
  const token = extractToken(req);
  const auth = token ? verifyToken(token) : null;
  if (!auth) {
    return res.status(401).json({ error: 'Sessió no vàlida o caducada. Torneu a iniciar sessió.' });
  }
  req.auth = auth;
  next();
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.auth.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Accés restringit a l\'administració municipal.' });
    }
    next();
  });
}

export function requireParty(req, res, next) {
  requireAuth(req, res, () => {
    if (req.auth.role !== 'PARTY' || !req.auth.id) {
      return res.status(403).json({ error: 'Accés restringit a les candidatures electorals.' });
    }
    next();
  });
}

