
let all_commands = [ // a command to description relation
    "1.  !commands - Get the list of all commands with an explanation",
    "2.  !about - Get general information/statistics about the WhizBot",
    "3.  !get currency *[currency]* - returns the exchange rate of the chosen currency pair, e.g. TL/USD",
    "4.  !get all prayers - Get the upcoming prayers for Turkey/Ankara",
    "5.  !get all prayers for *[city]* - Get all the upcoming prayers for the chosen *city*",
    "6.  !mention all - Mentions everyone inside the group",
    "7.  !remind *[all]* on prayers for *[for [city]]* - Automatically reminds after the prayer by 5 minutes, if *all* is set everyone will be menitoned",
    "8.  !remind *[all]* at *[time]* - Reminds once at the specificied *time*, if *all* is set then all will be mentioned, \nExample: '!remind all at 21/4 15:17'",
    "9.  !remind *[all]* after *[time]* - Reminds once after *time*. Example: remind after 2d 3h 5m . d for days, h for hours and m for minutes",
    "10. !get all reminders - Returns all reminders set inside this chat only",
    "11. !delete reminder *[reminder ID]* - Deletes the reminder using the reminder",
]
  
  const __version__ = "1.1.0";
  var started_running_at = new Date();
  let command_count = 0;

  const CITY_NOT_FOUND = "The city does not exist!"
  const UNAVAILABLE_CURRENCY = "The requested currency is unavailable!";
  
  let np_reminders = {} // this will hold all non-prayer reminders for the whole application, these reminders are referred as np_reminders (np - non-prayer)
  // The structure is the following: [Date Object, Chat ID, text of mentions for participants, Array of Contacts to be mentioned]

  let p_reminders = {} // These reminders are referred as p_reminders (p - prayers)
  // The structure is the following: [city, Chat ID, Array of Contacts to be mentioned, Array of Prayers]

  let reminder_callbacks = {} // {ID_ : NodeJS.timeout object}

  let prayers = ["fajr", "dhuhr", "asr", "maghrib", "isha"]
  let upcoming_prayer_indices = {}; // {ID_ : index}
  prayers_times_by_city = {}; // {city : [Dates Objects]}
  
  prayers_details_by_city = {}; // {city : [last_prayer_update, prayers_info]}

  const axios = require("axios");

  const moment = require("./moment.js")
  
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

      if (!response_['status_description'].toUpperCase().includes("FAILED")) {
        let str = response_['items'][0]['date_for'].split('-'); // ex. 2023-4-15
        let last_prayer_update = new Date(Number(str[0]), Number(str[1]) - 1, Number(str[2]));

        prayers_details_by_city[city] = [last_prayer_update, summarize_prayers(response_)];

        console.log(`last prayer update ${last_prayer_update.getTime()}`)
      } else {
        console.log("CITY ERROR!")
        return CITY_NOT_FOUND
      }
  
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

  function get_about_msg() {

    return 'I am a multi-purpose Whatsapp Chatbot designed by *Hasan Amkieh* named *WhizBot*\n\n'+
    'I was designed using the whatsapp-web package, deployed on Deno\n\n'+
    `Served Commands: *${command_count}*\nTotal minutes of runtime: *${runtime_mins}*\n`+
    `Version: *${__version__}*\n\n`+
    `To get all the commands I support just hit me with *!commands*\n\n` +
    "Source Code: https://github.com/Hasan-Amkieh/WhizBot/blob/main/index.js"

  }

  async function get_next_prayer_date(city = 'ankara')  { // Returns [prayer index, prayer Date]

    if (typeof prayers_details_by_city[city] == "undefined"
        || (new Date().getTime() - prayers_details_by_city[city][0].getTime()) >= 86400000) { // if the date is one day ago, then it shall be update
        await get_all_prayers(city); // This will automatically update the last_prayer_update and prayers_details
    }

    prayers_times_ = [];
    for (let i = 0 ; i < 5 ; i++) {
        prayers_times_.push(new Date())
    }

    // 1. Get all the prayers needed (1, 3, 4, 5, 6 indices) and their times converted into Date objects
    let indices = [1, 3, 4, 5, 6];
    prayers_info_ = prayers_details_by_city[city][1].split("\n");
    let str;
    let i = 0;
    indices.forEach((index) => {
        str = prayers_info_[index].split(" - ")[1];
        let time = str.split(" ")[0].split(":");
        prayers_times_[i].setHours((Number(time[0] == 12) ? 0 : Number(time[0])) + (str.includes("pm") ? 12 : 0)); // If PM +12 / If AM +0
        prayers_times_[i].setMinutes(Number(time[1]))
        /*if ((Date.now() - prayers_times_[i].getTime()) > 0) {
            prayers_times_[i] = moment(prayers_times_[i]).add(1, 'days').toDate();
        }*/
        i++;
    })

    // Check:
    console.log("Prayer times:")
    prayers_times_.forEach(p_time => {
        console.log(`${moment(p_time).format("MMMM Do YYYY, h:mm:ss a")} \n`);
    });

    // 2. Determine the upcoming prayer by looping through two of the dates consecutivly,
    let next_prayer_index = 0;
    let now_ms = Date.now();
    for (let index = 0 ; index < 4 ; index++) {
        if ((now_ms - prayers_times_.at(index).getTime()) > 0 && (prayers_times_.at(index+1).getTime() - now_ms) > 0) {
            next_prayer_index = index + 1;
            break;
        }
    }

    prayers_times_by_city[city] = prayers_times_;

    return [next_prayer_index, prayers_times_[next_prayer_index]];

  }

  let process_p_reminder = async (ID_) => {
        
    await (await client.getChatById(p_reminders[ID_][1])).sendMessage(`[${ID_}] Prayer ${prayers[upcoming_prayer_indices[ID_]]} time has come. ${p_reminders[ID_][2]}`, p_reminders[ID_][3]);
    console.log("Length of of p_reminders: " + Object.keys(p_reminders).length)

    await get_next_prayer_date(p_reminders[ID_][0]); // City

    if (upcoming_prayer_indices[ID_] >= 4) {
        upcoming_prayer_indices[ID_] = 0;
    } else {
        upcoming_prayer_indices[ID_] = upcoming_prayer_indices[ID_] + 1;
    }

    // TEST: to be deleted:
    //prayers_times_by_city[p_reminders[ID_][0]][upcoming_prayer_indices[ID_]] = moment().add(1, 'minutes').toDate();
    //TEST;

    let ms_to_wait = prayers_times_by_city[p_reminders[ID_][0]][upcoming_prayer_indices[ID_]].getTime() - Date.now();
    while (ms_to_wait < 0) {
        ms_to_wait += 86400000; // equals to a day in ms
    }
    reminder_callbacks[ID_] = setTimeout(function() {process_p_reminder(ID_)}, ms_to_wait);

  };

  async function add_p_reminder(city, chat, mentions_text, msg_options, prayers_) { // [Chat Object, text of mentions for participants, Array of Contacts to be mentioned]

    // 1. Find an empty ID:
    // 1.1 first collect all the used IDs:
    let used_IDs = Object.keys(p_reminders);
    used_IDs = used_IDs.concat(Object.keys(np_reminders))

    //console.log(JSON.stringify(used_IDs))

    let ID_ = 0;
    // 1.2: Find an empty ID from the lowest:
    for (let ID = 1 ; ; ID++) {
        ID_ = 0;
        for (let index = 0 ; index < used_IDs.length ; index++) {
            if (ID === Number(used_IDs[index])) {
                ID_ = -1;
                break;
            }
        }
        if (ID_ === 0) {
            ID_ = ID;
            break;
        }
    }

    console.log("Length of p_reminders is: " + ID_)

    p_reminders[ID_] = [city, chat, mentions_text, msg_options, prayers_];

    obj = await get_next_prayer_date(city);
    upcoming_prayer_indices[ID_] = obj[0];

    // TEST: to be deleted:
    //obj[1] = moment().add(1, 'minutes').toDate();
    // TEST;

    console.log(`index: ${obj[0]}`)
    let ms_to_wait = obj[1].getTime() - Date.now();
    while (ms_to_wait < 0) {
        ms_to_wait += 86400000; // equals to a day in ms
    }
    reminder_callbacks[ID_] = setTimeout(function() {process_p_reminder(ID_)}, ms_to_wait);
    obj.push(ID_)
    return obj;

  }

  function add_np_reminder(date, chat, mentions_text, msg_options) { // [Date as String, Chat Object, text of mentions for participants, Array of Contacts to be mentioned]

    // 1. Find an empty ID:
    // 1.1 first collect all the used IDs:
    let used_IDs = Object.keys(np_reminders);
    used_IDs = used_IDs.concat(Object.keys(p_reminders));

    console.log(JSON.stringify(used_IDs))

    let ID_ = 0;
    // 1.2: Find an empty ID from the lowest:
    for (let ID = 1 ; ; ID++) {
        ID_ = 0;
        for (let index = 0 ; index < used_IDs.length ; index++) {
            if (ID === Number(used_IDs[index])) {
                ID_ = -1;
                break;
            }
        }
        if (ID_ === 0) {
            ID_ = ID;
            break;
        }
    }

    console.log("Length of reminders is: " + ID_)

    np_reminders[ID_] = [date, chat, mentions_text, msg_options];

    reminder_callbacks[ID_] = setTimeout(async () => {
        
        await (await client.getChatById(np_reminders[ID_][1])).sendMessage(`Reminder No. ${ID_} ${np_reminders[ID_][2]} is triggered`, np_reminders[ID_][3]);
        delete np_reminders[ID_];
        console.log("Length of of reminders: " + Object.keys(np_reminders).length)

    }, date.getTime() - new Date().getTime());

    return ID_;

  }

  function string_to_date(str_) { // Example:  4/14 19:17

    let day, month, hours, minutes;
    let i = 0;
    str_.split(" ").forEach(element => {
        if (i == 0) { // date:
            let date__ = element.split("/");
            day = date__[0];
            month = date__[1];
            i++;
        } else { // time:
            let time__ = element.split(":");
            hours = time__[0];
            minutes = time__[1];
        }
    });

    return new Date(new Date().getFullYear(), month - 1, day, hours, minutes);

  }

  async function get_currency(from_cur, to_cur) {

    const options = {
        method: 'GET',
        url: 'https://currency-converter-by-api-ninjas.p.rapidapi.com/v1/convertcurrency',
        params: {have: from_cur, want: to_cur, amount: '1'},
        headers: {
        'X-RapidAPI-Key': '1f2ac0471amsh9d24d9ba56c6564p10d1aejsnee5f204638e9',
        'X-RapidAPI-Host': 'currency-converter-by-api-ninjas.p.rapidapi.com'
        }
    };

    let response_;
    await axios.request(options).then(function (response) {
        if ("error" in response.data && response.data["error"].toUpperCase().includes("INVALID CURRENCIES")) {
            response_ = UNAVAILABLE_CURRENCY;
        } else {
	        response_ = response.data["new_amount"];
        }
    }).catch(function (error) {
        response_ = UNAVAILABLE_CURRENCY;
    });

    return response_;

  }
  
  const qrcode = require('qrcode-terminal')
  const WAWebJS = require("whatsapp-web.js")
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
        if(message.body.toUpperCase() === '!GET ALL PRAYERS') {
            ++command_count;
            received_result = false;
            await get_all_prayers().then((result) => {
                response = result;
            }).catch((err) => {
                console.error(err);
            });
  
            if (response == CITY_NOT_FOUND) {
                await message.reply(response);
            } else {
                await message.reply(summarize_prayers(response));
            }
        } else if (message.body.toUpperCase().includes('!GET CURRENCY ')) { // e.g: !GET CURRENCY TRY/USD // NOTE: the currency has to be 3-letters long, check it first
            
            let tmp_ = message.body.toUpperCase().split("CURRENCY ")[1].split("/");
            let response = "";
            if (tmp_[0].length == 3 && tmp_[1].length == 3) {
                let result = await get_currency(tmp_[0], tmp_[1]);
                if (result === UNAVAILABLE_CURRENCY) {
                    response = UNAVAILABLE_CURRENCY;
                } else {
                    response = `${result} ${tmp_[0]}/${tmp_[1]}`;
                }
            } else {
                response = "The currency should be 3-letters long!";
            }

            await message.reply(response);

         } else if(message.body.toUpperCase().includes('!GET ALL PRAYERS FOR ')) {
            ++command_count;
            received_result = false;
            await get_all_prayers(message.body.split(" ").at(-1)).then((result) => {
                response = result;
            }).catch((err) => {
                console.error(err);
            });
  
            if (response == CITY_NOT_FOUND) {
                await message.reply(response);
            } else {
                await message.reply(summarize_prayers(response));
            }
        } else if (message.body.toUpperCase() === '!ABOUT') {
            ++command_count;
            let runtime_mins = new Date().getTime() - started_running_at.getTime();
            runtime_mins = runtime_mins / (1000.0 * 60.0);
            runtime_mins = runtime_mins.toFixed(2);
            await message.reply(get_about_msg());
        } else if (message.body.toUpperCase() === '!COMMANDS') {
            ++command_count;
            answer = "";
            all_commands.forEach(element => {
                answer += element + "\n\n";
            });

            await message.reply(answer);
        } else if (message.body.toUpperCase() === '!MENTION ALL') {
            ++command_count;
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
        } else if (message.body.toUpperCase().includes('!REMIND') && message.body.toUpperCase().includes('ON PRAYERS')) { // command no.6
            // ex.: !remind all on prayers for ankara
            ++command_count;

            let chatID = message.from;
            let groupChat = await client.getChatById(chatID);
            
            let mentions = [];
            let mentions_text = "";

            if (message.body.toUpperCase().includes('ALL')) {
                for(let participant of groupChat.participants) {
                    mentions.push(await client.getContactById(participant.id._serialized));
                    mentions_text += `@${participant.id.user} `;
                }
            }

            city = message.body.toUpperCase().split("FOR ")[1].toLowerCase()
            let response__ = await get_all_prayers(city);
            if (response__ == CITY_NOT_FOUND) {
                await message.reply(response__);
            } else {
                obj = await add_p_reminder(city, chatID, mentions_text, {mentions}, prayers);
                let next_prayer = obj[1];
                await message.reply(`A new reminder was created with the number *${obj[2]}*,`+
                ` *${prayers[obj[0]]}* to be reminded at ${next_prayer.getHours()}:${next_prayer.getMinutes()}`);
            }
        } else if (message.body.toUpperCase().includes('!REMIND') && message.body.toUpperCase().includes('AT')) { // command no.7
            // Example: !remind all at 14/4 19:17
            ++command_count;

            let chatID = message.from;
            let groupChat = await client.getChatById(chatID);
            let arr_ = message.body.split(' ');
            
            let mentions = [];
            let mentions_text = "";
            let is_all = message.body.toUpperCase().includes('ALL');

            if (is_all) {
                for(let participant of groupChat.participants) {
                    mentions.push(await client.getContactById(participant.id._serialized));
                    mentions_text += `@${participant.id.user} `;
                }
            }

            time_string = arr_[is_all ? 3 : 2] + " " + arr_[is_all ? 4 : 3];
            console.log("The time string happened to be: " + time_string)
            let next_date = string_to_date(time_string);
            reminder_ID = add_np_reminder(next_date, chatID, mentions_text, {mentions});
  
            await message.reply(`A new reminder was created with the number *${reminder_ID}*, to be reminded at ${next_date.toLocaleDateString("en-GB") + ` ${next_date.getHours()}:${next_date.getMinutes()}`}`);
        } 
        else if (message.body.toUpperCase().includes('!REMIND') && message.body.toUpperCase().includes('AFTER')) { // Then it is command no.8
            // Example: !remind all after 2d 3h 5m / Will be reminded after 2 days, 2 hours and 5 mins

            ++command_count;
            let chatID = message.from;
            let groupChat = await client.getChatById(chatID);
            
            let mentions = [];
            let mentions_text = "";

            if (message.body.toUpperCase().includes('ALL')) {
                for(let participant of groupChat.participants) {
                    mentions.push(await client.getContactById(participant.id._serialized));
                    mentions_text += `@${participant.id.user} `;
                }
            }

            time_string = message.body.toUpperCase().split('AFTER ')[1].split(' ');

            moment_obj = moment();
            time_string.forEach(element => {
                console.log(`processing: ${element}`)
                if (element.at(-1) === 'D') {
                    moment_obj = moment_obj.add(Number(element.split('D')[0]), 'days')
                } else if (element.at(-1) === 'M') {
                    console.log(`adding minutes: ${element.split('M')[0]}`)
                    moment_obj = moment_obj.add(Number(element.split('M')[0]), 'minutes')
                } else if (element.at(-1) === 'H') {
                    moment_obj = moment_obj.add(Number(element.split('H')[0]), 'hours')
                }
            });
            let next_date = moment_obj.toDate();

            reminder_ID = add_np_reminder(next_date, chatID, mentions_text, {mentions});
  
            await message.reply(`A new reminder was created with the number *${reminder_ID}*, to be reminded at ${next_date.toLocaleDateString("en-GB") + ` ${next_date.getHours()}:${next_date.getMinutes()}`}`);
        } else if (message.body.toUpperCase() === "!GET ALL REMINDERS") {
            ++command_count;

            let chatID = message.from;
            let text = "";
            let counter = 1;

            for (const [ID_no, reminder] of Object.entries(p_reminders)) {
                if (reminder[1] == chatID) {
                    text += `${counter++}. remind ${(reminder[2] !== '') ? "all members" : ""} on all prayers for the city ${reminder[0]}\nID number = ${ID_no}\n\n`;
                }
            }

            // [Date Object, Chat ID, text of mentions for participants, Array of Contacts to be mentioned]
            for (const [ID_no, reminder] of Object.entries(np_reminders)) {
                if (reminder[1] == chatID) {
                    text += `${counter++}. remind ${(reminder[2] !== '') ? "all members " : ""}after ${((reminder[0].getTime() - Date.now()) / 60000).toFixed(2)} minutes\nID number = ${ID_no}\n\n`;
                }
            }

            await message.reply(text);

        } else if (message.body.toUpperCase().substring(0, 16) === "!DELETE REMINDER") { // 16 chars

            ++command_count;
            let chatID = message.from;
            let ID_ = Number(message.body.toUpperCase().split("REMINDER ")[1]);

            let response = `Reminder No.${ID_} has been deleted!`;
            if (ID_ in p_reminders) {
                if (chatID === p_reminders[ID_][1]) {
                    delete p_reminders[ID_];
                    delete upcoming_prayer_indices[ID_];
                    clearTimeout(reminder_callbacks[ID_])
                    delete reminder_callbacks[ID_];
                } else {
                    response = `There is no reminder with the number ${ID_}`;
                }
            } else if (ID_ in np_reminders) {
                if (chatID === np_reminders[ID_][1]) {
                    delete np_reminders[ID_];
                    clearTimeout(reminder_callbacks[ID_])
                    delete reminder_callbacks[ID_];
                } else {
                    response = `There is no reminder with the number ${ID_}`;
                }
            } else { // Error: No such remidner ID:
                response = `There is no reminder with the number ${ID_}`;
            }

            await message.reply(response);

        } else {
            console.log("Unsupported command!");
            try {
                console.log("the received command: " + JSON.stringify(messsage.body))
            } catch(err) {}
        }
    }
  
  }
  
