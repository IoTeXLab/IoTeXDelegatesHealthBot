const Discord = require("discord.js");
require('dotenv').config()
const client = new Discord.Client()
const monitor = require("./bpmonitor.js");
const moment = require("moment");

const HackathonParticipantRoleID ="869999422346518588";

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
    case process.env.HackathonRolePassword: 
      msg.delete(); //Supposed to delete message
      msg.channel.send("Welcome " + msg.author.toString() +", you have now write access to the <#869998846732816404> channel!\nFeel free to ask any questions or tag an admin.");
      var role = msg.guild.roles.cache.find(role => role.id == HackathonParticipantRoleID);
      if (role) msg.member.roles.add(role);
    default:  break;
  }
});

client.login(process.env.DISCORD_TOKEN)


// Check slow and stuck producers every 10 seconds
notifySlow();
notifyStuck();

function genMessage(producer, status) {
  let msg = "________________________\n";
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