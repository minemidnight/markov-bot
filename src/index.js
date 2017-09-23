const Eris = require("eris");
const config = require(`${__dirname}/../config.json`);
const Markov = require("markov-strings");

global.bot = new Eris(config.token);
require(`${__dirname}/rethink.js`);
bot.config = config;

let prefix;
bot.on("ready", () => {
	bot.editStatus("online", { game: "@Mark help" });
	prefix = new RegExp(`^(?:${`<@!?${bot.user.id}>`}|mark|m!),?(?:\\s+)?([\\s\\S]+)`, "i");
	console.log("-----------------\nBot Ready\n-----------------");
});

bot.on("messageCreate", async message => {
	if(message.author.bot) return;

	const match = message.content.match(prefix);
	if(!match && message.channel.guild) {
		if(bot.usersTracked.has(message.author.id)) {
			console.log(`Adding ${message.id} sent by ${message.author.id} (${message.author.username}) to database`);
			await r.table("messages").insert({
				authorID: message.author.id,
				content: message.content, messageID: message.id
			}).run();
		}

		return;
	} else if(match) {
		message.content = match[1].trim();
	}

	let command;
	if(!~message.content.indexOf(" ")) {
		command = message.content;
		message.content = "";
	} else {
		command = message.content.substring(0, message.content.indexOf(" "));
		message.content = message.content.substring(message.content.indexOf(" ")).trim();
	}
	command = command.toLowerCase().trim();

	if(command === "users") {
		let msg = "Users:\n";
		Array.from(bot.usersTracked.entries()).forEach(([key, value]) => {
			let user = bot.users.has(key) ? `${bot.users.get(key).username}#${bot.users.get(key).discriminator}` : key;
			msg += `${value} (${user})\n`;
		});

		message.channel.createMessage(msg);
	} else if(command === "toggleuser" && message.author.id === bot.config.ownerID) {
		let args = message.content.split(" ");
		if(bot.usersTracked.has(args[0])) {
			bot.usersTracked.delete(args[0]);
			await r.table("users").get(args[0]).delete().run();
			await r.table("messages").getAll(args[0], { index: "authorID" }).delete().run();

			message.channel.createMessage(`Removed ${args[0]} from users`);
		} else {
			bot.usersTracked.set(args[0], args[1]);
			await r.table("users").insert({ nickname: args[1], userID: args[0] }).run();

			message.channel.createMessage(`Added ${args[1]} (${args[0]}) to users`);
		}
	} else {
		let users = message.content && message.content.length ? message.content.split(" ") : [];
		users.push(command);

		const entries = Array.from(bot.usersTracked.entries());
		users = users.filter(user => entries.find(entry => entry[0] === user || entry[1].toLowerCase() === user));
		if(!users || !users.length) {
			message.channel.createMessage(`Invalid user(s) given`);
			return;
		}

		let messages = [];
		for(let user of users) {
			user = entries.find(entry => entry[0] === user || entry[1].toLowerCase() === user)[0];
			messages = messages.concat(await r.table("messages").getAll(user, { index: "authorID" })("content").run());
		}

		const markov = new Markov(messages, {
			maxLength: 2000,
			minScore: 30
		});

		await markov.buildCorpus();
		const { string: msg } = await markov.generateSentence();
		message.channel.createMessage(msg);
	}
});

bot.connect();
