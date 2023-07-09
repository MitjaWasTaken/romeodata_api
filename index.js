const express = require("express");
const fetch = require("node-fetch");
const NodeCache = require("node-cache");
const cache = new NodeCache();

const fs = require("fs");

const constants = require("./constants.js");
const pushNotificationController = require("./controllers/push-notification.controller.js");

const app = express();
app.use(express.json());
const port = 4282;

var last_date = "";

const logFilePath = `./logs/${new Date().toLocaleDateString("fi", {
    day: "numeric",
    month: "numeric",
    year: "2-digit",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
})}`;
fs.writeFile(
    logFilePath,
    `Log starting form ${Date().toLocaleString()}:\n\n`,
    function (err) {
        if (err) throw err;
        console.log("Log file created!");
    }
);

function time_sort(a, b) {
    return (
        new Date(a.scheduleStartStation.scheduledTime).getTime() -
        new Date(b.scheduleStartStation.scheduledTime).getTime()
    );
}

/**
 *
 * @param {String} number
 * @param {String} type
 * @param {String} past
 * @returns
 */
async function findWagon(number, type, past) {
    var headers = {
        "Accept-Encoding": "gzip",
        "Content-Type": "application/json",
    };

    const d = new Date();
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate("dd");

    const departure_date = `${year}-${(month < 10 ? "0" : "") + month}-${
        (day < 10 ? "0" : "") + day
    }`;

    // If data has already been retrieved today from digitraffic's api it will be retrieved from cache instead
    let json;
    if (departure_date == last_date) {
        json = cache.get("compositions");
    } else {
        last_date = departure_date;

        const url = `${constants.apiUrl}/compositions/${departure_date}`;
        const response = await fetch(url, { method: "GET", headers: headers });
        json = await response.json();

        cache.set("compositions", json);
    }

    var allTrainNumbers = findTrainNumbers(json, number, type);

    var pastTrainNumbers = [];
    var futureTrainNumbers = [];

    const currentTimeISO8601 = new Date().toISOString();

    for (var index in json) {
        var trainNumber = json[index].trainNumber;
        if (!allTrainNumbers.includes(trainNumber)) {
            continue;
        }
        const url = `${constants.apiUrl}/trains/${departure_date}/${trainNumber}`;
        const response = await fetch(url, { method: "GET", headers: headers });
        const trainInfo = await response.json();
        const parsedTrainInfo = {
            trainNumber: trainInfo[0].trainNumber,
            commuterLineID: trainInfo[0].commuterLineID,
            live: String(trainInfo[0].runningCurrently),
            scheduleStartStation: trainInfo[0].timeTableRows[0],
            scheduleEndStation:
                trainInfo[0].timeTableRows[
                    trainInfo[0].timeTableRows.length - 1
                ],
        };

        // Train will be driven in future
        if (
            json[index].journeySections[0].endTimeTableRow.scheduledTime >
            currentTimeISO8601
        ) {
            futureTrainNumbers.push(parsedTrainInfo);
        }
        // Train has been driven
        else {
            if (past != "true") continue;
            pastTrainNumbers.push(parsedTrainInfo);
        }
    }

    var trainNumbersJSON = {
        past: pastTrainNumbers.sort(time_sort),
        future: futureTrainNumbers.sort(time_sort),
    };

    return trainNumbersJSON;
}

function findTrainNumbers(json, vehicleNumber, wagonType) {
    var trainNumbers = [];
    for (var index in json) {
        if (json[index].trainType != "HL") continue;
        for (var section in json[index].journeySections) {
            for (var wagon in json[index].journeySections[section].wagons) {
                if (
                    json[index].journeySections[section].wagons[
                        wagon
                    ].vehicleNumber.slice(9, 11) == vehicleNumber &&
                    json[index].journeySections[section].wagons[wagon]
                        .wagonType == wagonType
                ) {
                    trainNumbers.push(json[index].trainNumber);
                }
            }
        }
    }
    return trainNumbers;
}

var wagonNumberWithLeadingZero = (num) => {
    return (parseInt(num) < 10 && num.length == 1 ? "0" : "") + num;
};

/**
 *
 * @param {String} ip
 * @param {String} url
 * @param {*} trainNumbers
 */
function log(ip, url, trainNumbers) {
    const log = `{${new Date().toLocaleString()}} Request from ${ip} to ${url}! Returned ${
        trainNumbers.past.length + trainNumbers.future.length
    } train(s)`;

    console.log(log);
    fs.appendFile(logFilePath, log + "\n", function (err) {
        if (err) console.error(err);
        return;
    });
}

app.get("/sm2/:number", async function (req, res) {
    const number = wagonNumberWithLeadingZero(req.params.number);
    const trainNumbers = await findWagon(
        number,
        constants.wagonTypes.sm2,
        req.query.past || false
    );
    log(req.ip, req.url, trainNumbers);
    res.send(trainNumbers);
});

app.get("/sm4/:number", async function (req, res) {
    const number = wagonNumberWithLeadingZero(req.params.number);
    const trainNumbers = await findWagon(
        number,
        constants.wagonTypes.sm4,
        req.query.past || false
    );
    log(req.ip, req.url, trainNumbers);
    res.send(trainNumbers);
});

app.get("/sm5/:number", async function (req, res) {
    const number = wagonNumberWithLeadingZero(req.params.number);
    const trainNumbers = await findWagon(
        number,
        constants.wagonTypes.sm5,
        req.query.past || false
    );
    log(req.ip, req.url, trainNumbers);
    res.send(trainNumbers);
});

app.post("/send-notification", pushNotificationController.sendPushNotification);

app.listen(port, () => {
    console.log(`Running on port ${port}`);
});
