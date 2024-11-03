
import passport from 'passport';
import { JoseKey } from '@atproto/jwk-jose';
import { Express } from 'express'
import { ensureLoggedIn } from 'connect-ensure-login'

import { createOAuthClient, createATProtocolLoginMiddleware, ATprotocolStrategy } from 'passport-atprotocol';
import { Config } from './config';

async function setupKeys() {
	const keyset = [
	  await JoseKey.fromImportable(process.env.PRIVATE_KEY_1!),
	  await JoseKey.fromImportable(process.env.PRIVATE_KEY_2!),
	  await JoseKey.fromImportable(process.env.PRIVATE_KEY_3!),
	];
	return keyset;
  }
  
async function configureAtproto(app: Express, cfg: Config) {
	const keyset = await setupKeys()
	const ENDPOINT = `https://${cfg.hostname}`
	
	const clientMetadata = {
		client_name: 'My Passport atproto OAuth App',
		client_uri: ENDPOINT,
		client_id: `${ENDPOINT}/auth/atprotocol/client-metadata.json`,
		logo_uri: `${ENDPOINT}/logo.png`,
		tos_uri: `${ENDPOINT}/tos`,
		policy_uri: `${ENDPOINT}/policy`,
		jwks_uri: `${ENDPOINT}/auth/atprotocol/jwks.json`,
		redirect_uris: [`${ENDPOINT}/auth/atprotocol/callback`],
		grant_types: ['authorization_code'],
		response_types: ['code'],
		scope: 'atproto transition:generic',
		token_endpoint_auth_method: 'private_key_jwt',
		token_endpoint_auth_signing_alg: 'ES256',
		application_type: 'web',
		dpop_bound_access_tokens: true,
	  };
	  
	  //@ts-expect-error Something
	  const oauthClient = createOAuthClient({ clientMetadata, keyset });
	  
	  const strategy = new ATprotocolStrategy(
		{
		  oauthClient,
		  passReqToCallback: true,
		},
		function ({ req, accessToken, refreshToken, profile, tokenExpiry, callback }) {
		  if (req) {
			//@ts-expect-error User is added
			req.user = profile;
		  }
  
		  const passportUserSession = {
			profile,
			accessToken,
			refreshToken,
			tokenExpiry,
		  };
  
		  // async verification, for effect
		  process.nextTick(function () {
			return callback(null, passportUserSession, null);
		  });
		},
	  );
	  
	  passport.use(strategy)
	  passport.serializeUser((user, done) => {
		done(null, user);
	  });
  
	  passport.deserializeUser((user, done) => {
		if (!user?.tokenExpiry) {
		  return done(null, user);
		}
  
		const expiryDate = new Date(user.tokenExpiry);
		const currentDate = new Date();
  
		if (currentDate <= expiryDate) {
		  return done(null, user);
		}
 
		console.log("Refreshing token")
		strategy
		  .refreshAccessToken(user)
		  .then((updatedUser) => done(null, updatedUser))
		  .catch((err) => done(err));
	  });

	  app.get('/auth/atprotocol/jwks.json', (req, res) => res.json(oauthClient.jwks));
	  app.get('/auth/atprotocol/client-metadata.json', (req, res) => res.json(clientMetadata))
	  app.get('/login/atproto', createATProtocolLoginMiddleware({ oauthClient }));
	  app.get(
		'/auth/atprotocol/callback',
		// Note: use returnRawProfile=true if you want all the full profile stored in the session
		// passport.authenticate('atprotocol', { returnRawProfile: true }),
		passport.authenticate('atprotocol'),
		(req, res) => {
		  res.redirect('/');
		},
	  );

	  app.get('/auth/atprotocol/logout', (req, res) => {
			//@ts-expect-error Passport adds logout
		req.logout((err) => {
		  if (err) {
			console.error('Logout error:', err);
		  }
		  res.redirect('/');
		});
	  });
	  
	  app.get('/auth/atprotocol/revoke', ensureLoggedIn({ redirectTo: '/login'}), (req, res) => {
		oauthClient
			//@ts-expect-error User is there
		  .revoke(req.user.profile.did)
		  .then(() => {
			//@ts-expect-error Passport adds logout
			req.logout((err) => {
			  if (err) {
				console.error('Logout error:', err);
			  }
			  res.redirect('/');
			});
		  })
		  .catch((error) => {
			res.status(500).send('Failed to revoke token: ' + error.message);
		  });
	  });
}

export default configureAtproto
