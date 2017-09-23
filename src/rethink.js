const rethinkdbdash = require("rethinkdbdash");
module.exports = {
	init: async () => {
		const { database } = require(`${__dirname}/../config.json`);

		database.silent = true;
		database.db = "MarkovBot";
		global.r = rethinkdbdash(database); // eslint-disable-line id-length

		let dbs = await r.dbList().run();
		if(!~dbs.indexOf(database.db)) {
			await r.dbCreate(database.db).run();
		}

		let tableList = await r.tableList().run();
		let tablesExpected = [{
			name: "messages",
			primary: "messageID",
			indexes: ["authorID"]
		}, {
			name: "users",
			primary: "userID"
		}];

		for(let table of tablesExpected) {
			if(~tableList.indexOf(table.name)) continue;

			await r.tableCreate(table.name, { primaryKey: table.primary }).run();
			if(table.indexes) {
				for(let index of table.indexes) await r.table(table.name).indexCreate(index).run();
			}
		}

		bot.usersTracked = new Map();
		const users = await r.table("users").run();
		users.forEach(user => bot.usersTracked.set(user.userID, user.nickname));
	}
};
module.exports.init();
