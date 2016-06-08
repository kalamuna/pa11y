// This file is part of pa11y-dashboard.
//
// pa11y-dashboard is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// pa11y-dashboard is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with pa11y-dashboard.  If not, see <http://www.gnu.org/licenses/>.

'use strict';

var createClient = require('pa11y-webservice-client-node');
var EventEmitter = require('events').EventEmitter;
var express = require('express');
var hbs = require('express-hbs');
var http = require('http');
var pkg = require('./package.json');

module.exports = initApp;

// Initialise the application
function initApp(config, callback) {
	config = defaultConfig(config);

	var webserviceUrl = config.webservice;
	if (typeof webserviceUrl === 'object') {
		webserviceUrl = 'http://' + webserviceUrl.host + ':' + webserviceUrl.port + '/';
	}

	var app = new EventEmitter();
	app.address = null;
	app.express = express();
	app.server = http.createServer(app.express);
	app.webservice = createClient(webserviceUrl);

	// Compression
	app.express.use(express.compress());

	// Public files
	app.express.use(express.static(__dirname + '/public', {
		maxAge: (process.env.NODE_ENV === 'production' ? 604800000 : 0)
	}));

	// General express config
	app.express.disable('x-powered-by');
	app.express.use(express.bodyParser());

	// View engine
	app.express.set('views', __dirname + '/view');
	app.express.engine('html', hbs.express3({
		extname: '.html',
		contentHelperName: 'content',
		layoutsDir: __dirname + '/view/layout',
		partialsDir: __dirname + '/view/partial',
		defaultLayout: __dirname + '/view/layout/default'
	}));
	app.express.set('view engine', 'html');

	// View helpers
	require('./view/helper/date')(hbs.registerHelper);
	require('./view/helper/string')(hbs.registerHelper);
	require('./view/helper/url')(hbs.registerHelper);

	// Populate view locals
	app.express.locals({
		lang: 'en',
		year: (new Date()).getFullYear(),
		version: pkg.version,
		repo: pkg.homepage,
		bugtracker: pkg.bugs,
		noindex: config.noindex,
		readonly: config.readonly,
		siteMessage: config.siteMessage
	});

	app.express.use(function(req, res, next) {
		res.locals.isHomePage = (req.path === '/');
		res.locals.host = req.host;
		next();
	});

	// Allow only certain IPs, when not in development:
	// http://drupal.ucsf.edu/creating-site-restricted-ucsf-network-space
	var ips = [
		// Kalamuna IPs
		'135.23.71.118',
		'70.36.226.29'
	];
	for (var x = 0; x < 256; x++) {
		for (var y = 0; y < 256; y++) {
			ips.push('169.230.' + x + '.' + y);
			ips.push('128.218.' + x + '.' + y);
			ips.push('64.54.' + x + '.' + y);
		}
	}
	var restrictIp = process.env.NODE_ENV != 'private';
	if (process.env.DEVELOPMENT) {
		restrictIp = false;
	}
	if (restrictIp) {
		app.express.use(require('express-ip-access-control')({
			mode: 'allow',
			allows: ips,
			redirectTo: 'http://help.ucsf.edu/HelpApps/ipNetVerify.php',
			statusCode: 302
		}));
	}

	// HTTP Authentication.
	if (process.env.NODE_ENV == 'private') {
		var user = require('./config/user.json');
		app.express.use(require('basic-auth-connect')(user.name, user.pass));
	}

	// Load routes
	require('./route/index')(app);
	require('./route/task/index')(app);
	require('./route/result/index')(app);
	require('./route/result/download')(app);
	if (!config.readonly) {
		require('./route/new')(app);
		require('./route/task/delete')(app);
		require('./route/task/run')(app);
		require('./route/task/edit')(app);
		require('./route/task/ignore')(app);
		require('./route/task/unignore')(app);
	}

	// Error handling
	app.express.get('*', function(req, res) {
		res.status(404);
		res.render('404');
	});
	app.express.use(function(err, req, res, next) {
		/* jshint unused: false */
		if (err.code === 'ECONNREFUSED') {
			err = new Error('Could not connect to pa11y-webservice');
		}
		app.emit('route-error', err);
		if (process.env.NODE_ENV !== 'production') {
			res.locals.error = err;
		}
		res.status(500);
		res.render('500');
	});

	app.server.listen(config.port, function(err) {
		var address = app.server.address();
		app.address = 'http://' + address.address + ':' + address.port;
		callback(err, app);
	});

}

// Get default configurations
function defaultConfig(config) {
	if (typeof config.noindex !== 'boolean') {
		config.noindex = true;
	}
	if (typeof config.readonly !== 'boolean') {
		config.readonly = false;
	}
	return config;
}
