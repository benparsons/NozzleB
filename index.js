const bot = require('./bot.js');
const argv = require('yargs').argv

bot.start(() => {
    console.log("sync complete");
    if (argv.w) {

    }
});