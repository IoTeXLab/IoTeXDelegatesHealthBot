const Discord = require("discord.js");
const { getNamedType } = require("graphql");
require('dotenv').config()
const client = new Discord.Client()
const monitor = require("./bpmonitor.js");
const moment = require("moment");

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

function genMessage(producer, status) {
  let msg = "";
  msg += "**"+producer.registeredName + "** is "+ status +"\n";
  msg += "```";
  msg += moment().format('MMMM Do YYYY, h:mm:ss a') + "\n";
  msg += "Current Epoch : " + monitor.GetEpoch() + "\n";
  msg += "Current Height: " + monitor.GetHeight() + "\n\n";
  msg += "Production: " + producer.production + "\n";
  msg += "Expected  : " + monitor.GetExpectedProduction() + "\n";
  msg += "________________________\n";
  msg += "```";

  return msg;
}


function notifySlow() {
  if (monitor.SlowProducers().length == 0) {
    setTimeout(notifySlow,5 * 1000);
    return;
  }
  let slow = monitor.SlowProducers().filter( p => p.notified != true);
  slow.forEach(b => {
    channel.send(genMessage(b, "SLOW 🐌"));
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
    channel.send(genMessage(b, "STUCK 💀"));
    monitor.SetStuckNotified(b);
  });
  setTimeout(notifyStuck,5 * 1000);
}