1. On phone, disable Settings --> Security and Privacy --> Auto Blocker.

2. On phone, enable Settings --> Developer Options --> USB debugging

3. Connect Phone to Laptop's USB port.

4. Terminal 1
    ```
    adb devices
    adb reverse tcp:5174 tcp:5174
    adb reverse --list
    ```

5. Terminal 2
    - `npm run dev-server`

6. Terminal 3
    - `npm run dev-mobile-usb`

7. Android Development Work on Chrome
    - `http://localhost:5174`

8. When finished:
    - stop adb terminal 1 with `ctrl + C`
    - `adb reverse --remove tcp:5174`
    - `adb reverse --list`
    - `adb kill-server`

9. `ctrl + C` out of other 2 terminals

10. Disconnect the USB cable

11. Restore settings:
    - Eisable Settings --> Security and Privacy --> Auto Blocker.
    - disable Settings --> Developer Options --> USB debugging