
let all_commands = { // a command to description relation
    "!commands" : "Get the list of all commands with an explanation",
    "!about" : "Get general information/statistics about the WhizBot",
    "!get all prayers " : "Get the upcoming prayers for Turkey/Ankara",
    "!get all prayers for *[city]*" : "get all the upcoming prayers for the chosen *city*",
    "!mention all" : "mentions everyone inside the group",
    "!remind all on prayers" : "Automatically mentions eveyone before the prayer by 5 minutes",
    "!remind all on *[prayers]*" : "Automatically mentions eveyone before the chosen prayers by 5 minutes",
    "!remind *[all]* at *[time]*" : "Calls the sender of the message at the specificied *time*, if *all* is set, then all it will be a group call instead",
    "!get reminders for this chat" : "Returns all reminders set inside this chat",
    "!delete reminder *[reminder ID]*" : "Deletes the reminder using the reminder ID",
}

let __version__ = "1.0.0";
var started_running_at = new Date();
let command_count = 0;

let all_reminders = [] // this will hold all the reminders for the whole application
// The structure is the following: 
// [ID, Date Object, Chat Object, Array of Contacts to be mentioned]

let last_prayer_update = new Date().getDate();

const axios = require("axios");

async function get_all_prayers(city = "ankara") {

    console.log("Getting info for the city " + city)

    const options = {
        method: 'GET',
        url: 'https://muslimsalat.p.rapidapi.com/' + city + '.json',
        headers: {
          'X-RapidAPI-Key': '1f2ac0471amsh9d24d9ba56c6564p10d1aejsnee5f204638e9',
          'X-RapidAPI-Host': 'muslimsalat.p.rapidapi.com'
        }
      };
      
      await axios.request(options).then(function (response) {
          console.log(response.data['prayer_method_name'])
          response_ = response.data;
      }).catch(function (error) {
          console.error(error);
      });

      last_prayer_update = new Date().getTime();

      return response_;
}

function summarize_prayers(obj) {

    let answer = obj['country_code'] + "/" + obj['query'] + ' on *' + obj['items'][0]['date_for'] + '*\n';
    
    let prayers = obj['items'][0];
    delete prayers['date_for'];
    let str = JSON.stringify(prayers).replaceAll('"', '').replaceAll("{", "").replaceAll("}", "").replaceAll(",", "\n");
    str.split("\n").forEach(prayer => {
        answer += prayer.replace(":", " - ") + "\n";
    });

    return answer;
}

const qrcode = require('qrcode-terminal');
const WAWebJS = require("whatsapp-web.js");
const {Client, LocalAuth} = require('whatsapp-web.js')

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', qr => {
    qrcode.generate(qr, {small: true});
});

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('message', processMessage);
 
client.initialize();

async function processMessage(message) {
     
	if (message.body[0] === '!') { // Then it is a command:
        if(message.body.toUpperCase() === '!Get All Prayers'.toUpperCase()) {
            ++command_count;
            received_result = false;
            await get_all_prayers().then((result) => {
                response = result;
            }).catch((err) => {
                console.error(err);
            });

            message.reply(summarize_prayers(response));
        } else if(message.body.toUpperCase().includes('!Get All Prayers for '.toUpperCase())) {
            ++command_count;
            received_result = false;
            await get_all_prayers(message.body.split(" ").at(-1)).then((result) => {
                response = result;
            }).catch((err) => {
                console.error(err);
            });

            message.reply(summarize_prayers(response));
        } else if (message.body.toUpperCase() === '!About'.toUpperCase()) {
            ++command_count;
            let runtime_mins = new Date().getTime() - started_running_at.getTime();
            runtime_mins = runtime_mins / (1000.0 * 60.0);
            runtime_mins = runtime_mins.toFixed(2);
            message.reply('I am a multi-purpose Whatsapp Chatbot designed by *Hasan Amkieh* named *WhizBot*\n\nI was designed using the whatsapp-web package, deployed on Deno\n\nServed Commands: *' + command_count + '*\n' + 'Total minutes of runtime: *' + runtime_mins + '*' + '\nVersion: *' + __version__ + '*\n\nTo get all the commands I support just hit me with *!commands*');
        } else if (message.body.toUpperCase() === '!Commands'.toUpperCase()) {
            answer = JSON.stringify(all_commands).replaceAll("{", "").replaceAll("}", "").replaceAll(":", " - ").replaceAll(",", "\n\n");
            answer = answer.replaceAll('"', '');
            message.reply(answer);
        } else if (message.body.toUpperCase() === '!mention all'.toUpperCase()) {
            let chatID = message.from;
            let groupChat = await client.getChatById(chatID); 
                    
            let text = "";
            let mentions = [];

            for(let participant of groupChat.participants) {
                const contact = await client.getContactById(participant.id._serialized);
            
                mentions.push(contact);
                text += `@${participant.id.user} `;
            }

            await groupChat.sendMessage(text, { mentions });

        } else if (message.body.toUpperCase() === '!remind all on prayers'.toUpperCase()) {
            let chatID = message.from;
            let groupChat = await client.getChatById(chatID);
                    
            let text = "";
            let mentions = [];

            for(let participant of groupChat.participants) {
                const contact = await client.getContactById(participant.id._serialized);
            
                mentions.push(contact);
                text += `@${participant.id.user} `;
            }

            await groupChat.sendMessage(text, { mentions });

        } else {
            console.log("Unsupported command!");
            // TODO: Comment out the following line: 
            try {
                console.log("the received command: " + JSON.stringify(messsage.body))
            } catch(err) {}
        }
    }

}
 
