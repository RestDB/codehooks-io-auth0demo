
/*
* Codehooks code for fetching user info for all routes using Auth0 authentication
*/

import { app, Datastore } from 'codehooks-js'
import fetch from 'node-fetch';

// middleware to get Auth0 user info in request
// all routes will now have access to user info in req.user

const userProfileFromAuth0 = ({ domain }) => async (req, res, next) => {
  try {
    const { authorization } = req.headers;
    if (authorization) {
      const token = authorization.replace('Bearer ','');
      const conn = await Datastore.open();

      // try to load user from codehooks.io key/value store
      const user = await conn.get(`token-${token}`, { keyspace: 'sessions'});

      // found in cache?
      if (user){
        req.user = JSON.parse(user);
        return next();
      }

      // fetch user from Auth0 API
      const resp = await fetch(`https://${domain}/userinfo`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      req.user = await resp.json();

      // store in key/value store for twenty minutes
      conn.set(`token-${token}`, JSON.stringify(req.user),{ keyspace: 'sessions', ttl: 1000 * 60 * 20}); // ttl twenty minutes
    }
    else {
      return res.sendStatus(401);
    }
    next();
  } catch (error) {
    next(error);
  } 
}

app.use(userProfileFromAuth0({domain: process.env.AUTH0_DOMAIN}));

app.get('/hello', (req, res) => {
  const nickname = (req.user && req.user.nickname) || 'anonymous';
  res.json({"message": `Hello ${nickname}`, user: req.user, now: new Date()});
});


// bind to serverless runtime
export default app.init();
