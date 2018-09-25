const bot = require('./bot.js');
const argv = require('yargs').argv;
const web = require('./web.js');

opts = {};
opts.recording = argv.r;

bot.start(opts, () => {
    console.log("sync complete");
    if (argv.w) {
        web.start(bot);
    }
});