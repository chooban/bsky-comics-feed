import passport from 'passport';
import GoogleStrategy from 'passport-google-oidc';
import {Express } from 'express'

const addPassport = (app: Express) => {
	passport.use(new GoogleStrategy({
		clientID: process.env['GOOGLE_CLIENT_ID'],
		clientSecret: process.env['GOOGLE_CLIENT_SECRET'],
		callbackURL: 'http://localhost:3000/oauth2/redirect/google'
	}, 
	function(issuer, profile, callback) {
		console.log(`Issuer: ${JSON.stringify(issuer)}`)
		console.log(`Profile: ${JSON.stringify(profile)}`)
		console.log(profile.displayName)
		return callback(null, {})
	}))
	
	passport.serializeUser(function(user, done) {
		console.log(`Serializing ${JSON.stringify(user)}`)
		done(null, user);
	  });
	  
	  passport.deserializeUser(function(user, done) {
		console.log(`Deserializing ${JSON.stringify(user)}`)
		done(null, user);
	  });
	
    app.get('/login/google', passport.authenticate('google'));
    app.get('/oauth2/redirect/google',
      passport.authenticate('google', { failureRedirect: '/admin/login', failureMessage: true }),
      function(req, res) {
        res.redirect('/admin/queues');
    });
}

export default addPassport
