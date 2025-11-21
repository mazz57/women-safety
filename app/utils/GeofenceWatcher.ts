import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { geofenceService } from "../services/api";
import AsyncStorage from "@react-native-async-storage/async-storage";

const GEOFENCE_TASK_NAME = "GEOFENCE_TRACKING_TASK";

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Define the background task
TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.error("Geofence Task Error:", error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const location = locations && locations[0];

    if (location) {
      try {
        // Only check if user is logged in
        const token = await AsyncStorage.getItem("token");
        if (!token) return;

        const response = await geofenceService.checkGeofence({
          location: {
            lat: location.coords.latitude,
            lon: location.coords.longitude,
          },
        });

        // Handle backend response for entry/exit alerts
        if (response && response.data) {
          const { event, geofence } = response.data;

          if (event === "enter" && geofence) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: "Entered Safe Zone",
                body: `You have entered ${geofence.name}`,
              },
              trigger: null,
            });
          } else if (event === "exit" && geofence) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: "Exited Safe Zone",
                body: `You have left ${geofence.name}`,
              },
              trigger: null,
            });
          }
        }
      } catch (err) {
        console.log("Geofence Check Failed:", err);
      }
    }
  }
});

export const startGeofenceWatcher = async () => {
  try {
    // 1. Request Permissions
    const { status: fgStatus } =
      await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== "granted") {
      console.log("Foreground location permission denied");
      return;
    }

    const { status: bgStatus } =
      await Location.requestBackgroundPermissionsAsync();
    if (bgStatus !== "granted") {
      console.log("Background location permission denied");
      return;
    }

    // 2. Check if task is already running
    const isRegistered =
      await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK_NAME);
    if (isRegistered) {
      console.log("Geofence watcher already running");
      return;
    }

    // 3. Start Location Updates
    await Location.startLocationUpdatesAsync(GEOFENCE_TASK_NAME, {
      accuracy: Location.Accuracy.Highest,
      timeInterval: 10000, // Check every 10 seconds
      distanceInterval: 10, // Or every 10 meters
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "Geofence Active",
        notificationBody: "Monitoring your safety zones...",
      },
    });

    console.log("Geofence watcher started");
  } catch (error) {
    console.error("Failed to start geofence watcher:", error);
  }
};

export const stopGeofenceWatcher = async () => {
  try {
    const isRegistered =
      await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK_NAME);
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(GEOFENCE_TASK_NAME);
      console.log("Geofence watcher stopped");
    }
  } catch (error) {
    console.error("Failed to stop geofence watcher:", error);
  }
};
