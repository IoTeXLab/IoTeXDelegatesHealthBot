const Discord = require("discord.js")
require('dotenv').config()
const client = new Discord.Client()
const monitor = require("./bpmonitor.js");

// starts the Block Producers monitor, polling every 10 seconds
monitor.Start(10);

var channel;

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`)
  channel = client.channels.cache.get(process.env.CHANNEL_ID);
  if (channel != undefined) console.log("Will send notifications to channel "+channel.name);
  else {
    console.log("Channel "+channel.id+" not found!")
    return;
  }
})

// Provide some manual commands
client.on("message", msg => {
  switch (msg.content) {
    case "/bp" : msg.reply(monitor.GetBlockProducersMsg()); break;
    case "/slow" : msg.reply(monitor.GetSlowProducersMsg()); break;
    case "/stuck" : msg.reply(monitor.GetStuckProducersMsg()); break;

    default:  break;
  }
});

client.login(process.env.DISCORD_TOKEN)


// Check slow and stuck producers every 10 seconds
notifySlow();
notifyStuck();

function notifySlow() {
  if (monitor.SlowProducers().length == 0) {
    setTimeout(notifySlow,5 * 1000);
    return;
  }
  let slow = monitor.SlowProducers().filter( p => p.notified != true);
  slow.forEach(b => {
    channel.send("🐌 **"+b.registeredName + "** is slow - this is a test"); 
    monitor.SetSlowNotified(b);
  });
  setTimeout(notifySlow,5 * 1000);
}

function notifyStuck() {
  if (monitor.StuckProducers().length == 0) {
    setTimeout(notifyStuck,5 * 1000);
    return;
  }
  let slow = monitor.StuckProducers().filter( p => p.notified != true);
  slow.forEach(b => {
    channel.send("💀 **"+b.registeredName + "** is stuck! - this is a test"); 
    monitor.SetStuckNotified(b);
  });
  setTimeout(notifyStuck,5 * 1000);
}