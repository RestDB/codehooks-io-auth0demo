
/*
* Auto generated Codehooks (c) example.
*/
import { app, Datastore } from 'codehooks-js'
import fetch from 'node-fetch';


// get user profile if not available and cache it
app.use(async (req, res, next) => {
  try {
    const { authorization } = req.headers;
    if (authorization) {
      const token = authorization.replace('Bearer ','');
      const conn = await Datastore.open();
      const user = await conn.get(`token-${token}`, { keyspace: 'sessions'});
      if (user){
        console.log("user fetched from cache");
        req.user = JSON.parse(user);
        return next();
      }
      console.log("fetching user from Auth0 API");
      const resp = await fetch(`https://${process.env.AUTH0_DOMAIN}/userinfo`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      req.user = await resp.json();
      conn.set(`token-${token}`, JSON.stringify(req.user),{ keyspace: 'sessions', ttl: 1000 * 60 * 20}); // ttl twenty minutes
    }
    next();
  } catch (error) {
    next(error);
  }
});

app.get('/hello', (req, res) => {
  console.log(req.user);
  res.json({"message": "hello " + req.user.nickname, user: req.user});
});


// bind to serverless runtime
export default app.init();
