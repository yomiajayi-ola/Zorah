// @desc 
import { Expo } from "expo-server-sdk";
const expo = new Expo();

export const sendPushNotification = async (pushToken, title, body) => {
    try {
        if (!Expo.isExpoPushToken(pushToken)) {
            console.error(`Invalid Expo push token: ${pushToken}`);
            return;
        }

        const message = {
            to: pushToken,
            sound: "default",
            title,
            body,
            data: { title, body },
        };

        await expo.sendPushNotificationsAsync([message]);
    } catch (error) {
        console.error("Push notification error", error);
    }
}