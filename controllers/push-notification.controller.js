const admin = require("firebase-admin");
const fcm = require("fcm-notification");

var serviceAccount = require("../config/push_notification_key.json");
const certPath = admin.credential.cert(serviceAccount);
var FCM = new fcm(certPath);

var sendPushNotification = (req, res) => {
    try {
        let message = {
            notification: {
                title: "Test",
                body: "This is a test notification",
            },
            data: {
                title: "Vittu jes avauduin onnituneesti!",
            },
            token: req.body.token,
        };

        FCM.send(message, function (err, resp) {
            if (err) {
                return res.status(500).send({
                    message: err,
                });
            }
            return res.status(200).send({
                message: "Notification sent",
            });
        });
    } catch (err) {
        throw err;
    }
};

module.exports = { sendPushNotification };
