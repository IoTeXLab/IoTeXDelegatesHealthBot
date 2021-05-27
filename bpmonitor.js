const Antenna = require("iotex-antenna").default;
const {	GraphQLClient } = require("graphql-request");

require('dotenv').config();

var updateProductionInterval;

let updating = false;
let currentEpoch = 0;
let bpCandidates = [];
let stuckProducers = [];
let slowProducers = []; 

exports.Start = StartPolling;
exports.SlowProducers = GetSlowProducers;
exports.StuckProducers = GetStuckProducers;
exports.SetSlowNotified = setSlowNotified;
exports.SetStuckNotified = setStuckNotified;

exports.GetBlockProducersMsg = GetBlockProducersMsg;
exports.GetSlowProducersMsg = GetSlowProducersMsg;
exports.GetStuckProducersMsg = GetStuckProducersMsg;

const antenna = new Antenna(process.env.IOTEX_API_SERVER);

function delegateToString(rank, delegate,code = false) {
    let line = "";
    if (code) line+="`";
    line += String(rank).padStart(2,"0") + ". " ;
    line += (delegate.name.replace("(龙猪)","")).padEnd(20," "); 
    line += delegate.active ? "     active" : "           ";
    line += delegate.active ? (String(delegate.production) +"/30").padStart(8," ") : "        ";
    line += isStuck(delegate) ? " 💀 stuck" : (isSlow(delegate) ? " 🐌 slow " : "     "); 
    if (code) line+="`";
    line += "\n";
    return line;
}

function GetBlockProducersMsg() {
    if (bpCandidates.length == 0) return "Block producers data not available yet";
    let count = 1;
    let reply = "```";
    bpCandidates.forEach((b)=> {
        if (count<36) {
          reply += delegateToString(count, b);
          count++;
        }
    })
    return reply + "```";
}

function GetSlowProducers() {
    return slowProducers;
}

function GetSlowProducersMsg() {
    if (!slowProducers.length) return "All of the block producers are aligned 😎";
    let reply = "```";
    let count = 1
    slowProducers.forEach((b)=> { reply += delegateToString(count, b); count++;});
    return reply+"```";
}

function GetStuckProducers() {
    return stuckProducers;
}

function GetStuckProducersMsg() {
    if (!stuckProducers.length) return "None of the block producers is stuck 😎";
    let reply = "```";
    let count = 1;
    stuckProducers.forEach((b)=> { reply += delegateToString(count, b); count++;});
    return reply+"```";
}

async function updateBlockProducers() {
    try {
        let chainMeta = (await antenna.iotx.getChainMeta()).chainMeta;
        updateEpoch(chainMeta.epoch.num);	

        // Query production data
        let epochMeta = (await antenna.iotx.getEpochMeta({ epochNumber: currentEpoch}));	
        let blockProducers = epochMeta.blockProducersInfo;

        bpCandidates = await getBpCandidates();

        // Merge production data into delegates info (the first 36 are enough)
        for (var i=0; i<blockProducers.length; i++) {
            let bp = blockProducers[i];
            let delegate = bpCandidates[i];

            delegate.active = bp.active;
            delegate.production = bp.production;
            delegate.address = bp.address;
            delegate.votes = bp.votes;
            delegate.isBlockProducer = true;
        }

        // Find slow and stuck delegates
        let maxProduction = Math.round(epochMeta.totalBlocks / 24);

        for (var i=0; i<36; i++) {
            let delegate = bpCandidates[i];
            if (delegate.active == false) continue;

            delegate.isSlow = false;
            delegate.isStuck = false;
            
            // Test olny:
            // if (delegate.registeredName == "metanyx") delegate.production = maxProduction -2;	
            // if (delegate.registeredName == "longz") delegate.production = maxProduction -2;	
            // if (delegate.registeredName == "iotexlab") delegate.production = maxProduction -6;			
            // End Test
            
            if (delegate.production < maxProduction - 5) {
                setStuck(delegate);				
            } else if (delegate.production < maxProduction - 1) {
                setslow(delegate);							
            }					
        };
    } catch (ex) {
        console.log("Exception in updateBlockProducers:\n",ex);
    } finally {
        setTimeout(updateBlockProducers, updateProductionInterval)
    }
}

function setStuck(delegate) {
    if (isStuck(delegate)) return;
    stuckProducers.push(delegate);
}


function setStuckNotified(b) {
    let found = stuckProducers.find(p => p.registeredName === b.registeredName);
    found.notified = true;
}

function isStuck(delegate) {
    let found = stuckProducers.find(d => d.registeredName === delegate.registeredName);
    return found;
}

function setslow(delegate) {
    if (isSlow(delegate)) return;
    slowProducers.push(delegate);
}

function setSlowNotified(b) {
    let found = slowProducers.find(p => p.registeredName === b.registeredName);
    found.notified = true;
}

function isSlow(delegate) {
    let found = slowProducers.find(d => d.registeredName === delegate.registeredName);
    return found;
}

// Start monitoring block producers every "interval" seconds
function StartPolling(interval = 10) {
    if (updating) return;
    updateProductionInterval = interval * 1000;

    try {
		updateBlockProducers(); 
        updating = true;
        console.log("Block Producers monitor is ready!");
	} catch (ex) {
		console.error("Error happened in startUpdateData: ")
		console.error(ex)
	}	
}

function updateEpoch(epoch) {
    if (epoch != currentEpoch) {
        // New epoch, reset data
        let slow=slowProducers.length;
        let stuck = stuckProducers.length;
        let slowNotStuck = slow - stuck;
        if (!slow && !stuck) console.log("✅✅ Epoch "+currentEpoch+" ended without issues.");
        else if (slow && !stuck) console.log("🐌 🐌 Epoch "+currentEpoch+" ended with "+slow+" slow producers.");
        else if (stuck && (slow == stuck)) console.log("💀 💀 Epoch "+currentEpoch+" ended with "+stuck+" stuck producers.");
        else console.log("💀 🐌 Epoch " + currentEpoch + " ended with " + stuckProducers.length + " stuck and " + slowProducers.length + " slow producers");
        slowProducers = [];
        stuckProducers = [];
        currentEpoch = epoch;
    }
}

async function getBpCandidates() {
    try
	{
		const query1 = `{
			bpCandidates {
				id, name, liveVotes, percent, registeredName, badges
			}
		}`;
		
		const graphQLClient = new GraphQLClient("https://member-api.iotex.io/api-gateway/", {
			headers: {
				'x-iotex-client-id': 'iotexlab',
				'Connection': 'keep-alive',
			},
		})

		return (await graphQLClient.request(query1)).bpCandidates;
    } catch (ex) {
        console.log("Exception in UpdateCandidates:\n",ex);
    }
}