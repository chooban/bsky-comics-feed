import passport from 'passport';
import GoogleStrategy from 'passport-google-oidc';

const addPassport = () => {
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
	
	return passport
}

export default addPassport
