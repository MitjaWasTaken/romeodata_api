import express from "express";
import fetch from "node-fetch";

import { apiUrl, wagonTypes } from "./constants.js";

const app = express();

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

    const url = `${apiUrl}/compositions/${departure_date}`;

    const response = await fetch(url, { method: "GET", headers: headers });

    const json = await response.json();

    var allTrainNumbers = findTrainNumbers(json, number, type);

    var pastTrainNumbers = [];
    var futureTrainNumbers = [];

    var trainNumbersJSON = {
        past: pastTrainNumbers,
        future: futureTrainNumbers,
    };
    const currentTimeISO8601 = new Date().toISOString();

    for (var index in json) {
        var trainNumber = json[index].trainNumber;
        if (!allTrainNumbers.includes(trainNumber)) {
            continue;
        }
        const url = `${apiUrl}/trains/${departure_date}/${trainNumber}`;
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
            pastTrainNumbers[trainNumber] = trainInfo[0];
        }
    }

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

app.get("/sm2/:number", async function (req, res) {
    const trainNumbers = await findWagon(
        wagonNumberWithLeadingZero(req.params.number),
        wagonTypes.sm2,
        req.query.past || false
    );
    res.send(trainNumbers);
});

app.get("/sm4/:number", async function (req, res) {
    const trainNumbers = await findWagon(
        wagonNumberWithLeadingZero(req.params.number),
        wagonTypes.sm4,
        req.query.past || false
    );
    res.send(trainNumbers);
});

app.get("/sm5/:number", async function (req, res) {
    const trainNumbers = await findWagon(
        wagonNumberWithLeadingZero(req.params.number),
        wagonTypes.sm5,
        req.query.past || false
    );
    res.send(trainNumbers);
});

app.get("/timetable/:station", function (req, res) {
    res.send();
});

app.listen(3000);
