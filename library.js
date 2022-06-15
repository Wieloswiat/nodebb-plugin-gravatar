"use strict";

var user = require.main.require('./src/user'),
	meta = require.main.require('./src/meta'),
	db = require.main.require('./src/database'),
	winston = require.main.require('winston'),
	crypto = require('crypto'),

	controllers = require('./lib/controllers'),
	plugin = {};

plugin.init = async function({router, middleware}) {
	router.get('/admin/plugins/gravatar', middleware.admin.buildHeader, controllers.renderAdminPage);
	router.get('/api/admin/plugins/gravatar', controllers.renderAdminPage);
	try {
		plugin.settings = meta.settings.get('gravatar')
	}
	catch {
		winston.error('[plugin/gravatar] Could not retrieve plugin settings! Using defaults.');
		plugin.settings = {
			default: false,
			force: false
		};
	}
};

plugin.addAdminNavigation = async function(header) {
	header.plugins.push({
		route: '/plugins/gravatar',
		icon: 'fa-picture',
		name: 'Gravatar'
	});

	return header
};

plugin.list = async function(data) {
	const userData = await user.getUserFields(data.uid, ['email', 'username'])
	data.pictures.push({
		type: 'gravatar',
		url: getGravatarUrl(userData.email, userData.username),
		text: 'Gravatar'
	})
	return data;
};

plugin.get = async function(data) {
	if (data.type === 'gravatar') {
		const userData = await user.getUserFields(data.uid, ['email', 'username'])
		data.picture = getGravatarUrl(userData.email, userData.username);
	}
	return data;
};

plugin.updateUser = async function(data) {
	if (plugin.settings.default === 'on') {
		winston.verbose('[plugin/gravatar] Updating uid ' + data.user.uid + ' to use gravatar');
		data.user.picture = getGravatarUrl(data.user.email, data.user.username);	
	}
	return data;
};

plugin.onForceEnabled = async function(users) {
	if (plugin.hasOwnProperty('settings') && plugin.settings.force === 'on') {
		users = await Promise.all(users.map(async function(userObj) {
			if (!userObj) {
				return userObj;
			}

			if (!userObj.email) {
				const email = await db.getObjectField('user:' + userObj.uid, 'email')
				userObj.picture = getGravatarUrl(email, userObj.username);
			} else {
				userObj.picture = getGravatarUrl(userObj.email, userObj.username);
			}
			return userObj
		}));
	} else if (plugin.hasOwnProperty('settings') && plugin.settings.default === 'on') {
		users = await Promise.all(users.map(async function(userObj) {
			if (!userObj) {
				return userObj;
			}
			if (userObj.picture === null || userObj.picture === '') {
				if (!userObj.email) {
					const email = await db.getObjectField('user:' + userObj.uid, 'email')
					userObj.picture = getGravatarUrl(email, userObj.username);
				} else {
					userObj.picture = getGravatarUrl(userObj.email, userObj.username);
				}
			}
			return userObj;
		}));
	}
	return users;
}

function getGravatarUrl(userEmail, username) {
	var email = userEmail || "",
		size = parseInt(meta.config.profileImageDimension, 10) || 128,
		baseUrl = 'https://www.gravatar.com/avatar/' + sum(email) + '?size=192',
		customDefault = plugin.settings.customDefault;

	if (customDefault) {
		// If custom avatar provider is a URL, replace possible variables with values.
		if (customDefault.indexOf('http') == 0) { //Use explicit check for increased readability.
			customDefault = customDefault.replace(/%md5/i, sum(email));
			customDefault = customDefault.replace(/%email/i, email);
			customDefault = customDefault.replace(/%user/i, username);
			customDefault = customDefault.replace(/%size/i, size);
			customDefault = customDefault.replace(/%userhash/i, sum(username));
		}
		baseUrl += '&d=' + encodeURIComponent(customDefault);
	} else if (plugin.settings.iconDefault) {
		baseUrl += '&d=' + plugin.settings.iconDefault;
	}

	return baseUrl;
};

function sum(email) {
	var md5sum = crypto.createHash('md5');
	md5sum.update(String(email).trim().toLowerCase());
	md5sum = md5sum.digest('hex');
	return md5sum;
}

module.exports = plugin;
