import React, { useState } from "react";
import { Button, Alert } from "reactstrap";
import SyntaxHighlighter from 'react-syntax-highlighter';
import { useAuth0, withAuthenticationRequired } from "@auth0/auth0-react";
import { getConfig } from "../config";
import Loading from "../components/Loading";

const codehooksCode = `
/*
* Codehooks code for fetching user info for all routes using Auth0 authentication
*/

import { app, Datastore } from 'codehooks-js'
import fetch from 'node-fetch';

// middleware to get Auth0 user info in request
// all routes will now have access to user info in req.user
// adapt this to your own needs

const userProfileFromAuth0 = async (req, res, next) => {
  try {
    const { authorization } = req.headers;
    if (authorization) {
      const token = authorization.replace('Bearer ','');
      const conn = await Datastore.open();

      // try to load user from codehooks.io key/value store
      const user = await conn.get(\`token-\${token}\`, { keyspace: 'sessions'});

      // found in cache?
      if (user){
        req.user = JSON.parse(user);
        return next();
      }

      // fetch user from Auth0 API
      const resp = await fetch(\`https://\${process.env.AUTH0_DOMAIN}/userinfo\`, {
        headers: {
          Authorization: \`Bearer \${token}\`,
        },
      });
      req.user = await resp.json();

      // store in key/value store for twenty minutes
      conn.set(\`token-\${token}\`, JSON.stringify(req.user),{ keyspace: 'sessions', ttl: 1000 * 60 * 20}); // ttl twenty minutes
    }
    else {
      return res.sendStatus(401);
    }
    next();
  } catch (error) {
    next(error);
  } 
}

app.use(userProfileFromAuth0);

// the route we call from the auth0 example api call client
app.get('/hello', async (req, res) => {
  const nickname = (req.user && req.user.nickname) || 'anonymous'; // because of the middleware, we now have the user in req.user
  const conn = await Datastore.open();
  const apicounter = await conn.incr('apicounter', 1); // increase a counter for each call 
  res.json({"message": \`Hello \${nickname}\`, user: req.user, now: new Date(), apicounter});
});

// bind to serverless runtime
export default app.init();
`;

export const ExternalApiComponent = () => {
  const { apiOrigin = "https://mybackend-r96a.api.codehooks.io", audience } = getConfig();

  const [state, setState] = useState({
    showResult: false,
    apiMessage: "",
    error: null,
  });

  const {
    getAccessTokenSilently,
    loginWithPopup,
    getAccessTokenWithPopup,
  } = useAuth0();

  const handleConsent = async () => {
    try {
      await getAccessTokenWithPopup();
      setState({
        ...state,
        error: null,
      });
    } catch (error) {
      setState({
        ...state,
        error: error.error,
      });
    }

    await callApi();
  };

  const handleLoginAgain = async () => {
    try {
      await loginWithPopup();
      setState({
        ...state,
        error: null,
      });
    } catch (error) {
      setState({
        ...state,
        error: error.error,
      });
    }

    await callApi();
  };

  const callApi = async () => {
    try {
      const token = await getAccessTokenSilently();

      const response = await fetch(`${apiOrigin}/dev/hello`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const responseData = await response.json();
      setState({
        ...state,
        showResult: true,
        apiMessage: responseData,
      });
    } catch (error) {
      setState({
        ...state,
        error: error.error,
      });
    }
  };

  const handle = (e, fn) => {
    e.preventDefault();
    fn();
  };

  return (
    <>
      <div className="mb-5">
        {state.error === "consent_required" && (
          <Alert color="warning">
            You need to{" "}
            <a
              href="#/"
              class="alert-link"
              onClick={(e) => handle(e, handleConsent)}
            >
              consent to get access to users api
            </a>
          </Alert>
        )}

        {state.error === "login_required" && (
          <Alert color="warning">
            You need to{" "}
            <a
              href="#/"
              class="alert-link"
              onClick={(e) => handle(e, handleLoginAgain)}
            >
              log in again
            </a>
          </Alert>
        )}

        <h1>External codehooks.io API call (authenticated)</h1>
        <p className="lead">
          Ping the authenticated <a href="https://codehooks.io">codehooks.io</a> API by clicking the "Ping codehooks.io API" button below.
        </p>

        <p>
          This will call the /dev/hello API endpoint on a <a href="https://codehooks.io">codehooks.io</a> space. An access token is sent as part
          of the request's `Authorization` header and the token will be validated by codehooks by using the <a target="_blank" rel="noreferrer" href="https://auth0.com/docs/secure/tokens/json-web-tokens/json-web-key-sets">JWKS endpoint</a> of the Auth0 domain.</p> 
        <p>
            Auth0 exposes a JWKS endpoint for each tenant, which is found at <code>https://YOUR_DOMAIN/.well-known/jwks.json.</code> This endpoint will contain the JWK used to verify all Auth0-issued JWTs for this tenant. 
        </p>
        <p>
          To verify all tokens using the JWKS endpoint, you can add this endpoint using the <a href="https://codehooks.io/docs/cli">codehooks CLI </a> like this: <code> codehooks jwks ENDPOINT_URL</code> or using the user admin interface at <a href="https://account.codehooks.io">https://account.codehooks.io</a>. You can read more about this in the <a href="https://codehooks.io/docs/authentication#authenticate-users-with-jwt-using-jwks">codehooks.io documentation.</a> 
        </p>

          <p>In the bottom of this page 👇, we show all the server code and the middleware which fetch and cache the user profile in the key/value datastore of codehooks.io. All routes will have accessible the user JWT object in the req.user property which can for example be used to access and write user specific data in the codehooks.io database.</p>
        {!audience && (
          <Alert color="warning">
            <p>
              You can't call the API at the moment because your application does
              not have any configuration for <code>audience</code>, or it is
              using the default value of <code>YOUR_API_IDENTIFIER</code>. You
              might get this default value if you used the "Download Sample"
              feature of{" "}
              <a href="https://auth0.com/docs/quickstart/spa/react">
                the quickstart guide
              </a>
              , but have not set an API up in your Auth0 Tenant. You can find
              out more information on{" "}
              <a href="https://auth0.com/docs/api">setting up APIs</a> in the
              Auth0 Docs.
            </p>
            <p>
              The audience is the identifier of the API that you want to call
              (see{" "}
              <a href="https://auth0.com/docs/get-started/dashboard/tenant-settings#api-authorization-settings">
                API Authorization Settings
              </a>{" "}
              for more info).
            </p>

            <p>
              In this sample, you can configure the audience in a couple of
              ways:
            </p>
            <ul>
              <li>
                in the <code>src/index.js</code> file
              </li>
              <li>
                by specifying it in the <code>auth_config.json</code> file (see
                the <code>auth_config.json.example</code> file for an example of
                where it should go)
              </li>
            </ul>
            <p>
              Once you have configured the value for <code>audience</code>,
              please restart the app and try to use the "Ping API" button below.
            </p>
          </Alert>
        )}

        <Button
          color="primary"
          className="mt-5"
          onClick={callApi}
          disabled={!audience}
        >
          Ping codehooks.io API
        </Button>
      </div>
      <div className="result-block-container">
        {state.showResult && (
          <div data-testid="api-result">
            <h6 className="muted">Result from authenticated GET call to codehooks endpoint /dev/hello</h6>
            <SyntaxHighlighter>
             {JSON.stringify(state.apiMessage, null, 2)}
            </SyntaxHighlighter>
          </div>
        )}
      </div>
      <div>
        <h2>Codehooks.io middleware and server code for this example</h2>
        <SyntaxHighlighter language="javascript">
          {codehooksCode}
        </SyntaxHighlighter>
      </div>
    </>
  );
};

export default withAuthenticationRequired(ExternalApiComponent, {
  onRedirecting: () => <Loading />,
});
