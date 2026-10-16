@echo off
REM 把网页文件同步进 Android 工程的 assets（Windows 本地打包时用）
set DEST=android\app\src\main\assets\www

if exist "%DEST%" rmdir /s /q "%DEST%"
mkdir "%DEST%\js"

copy index.html "%DEST%\" >nul
copy home.html "%DEST%\" >nul
copy chat.html "%DEST%\" >nul
copy note.html "%DEST%\" >nul
copy timer.html "%DEST%\" >nul
copy music.html "%DEST%\" >nul
copy moments.html "%DEST%\" >nul
copy letter.html "%DEST%\" >nul
copy settings.html "%DEST%\" >nul
copy style.css "%DEST%\" >nul
copy player.js "%DEST%\" >nul
copy config.js "%DEST%\" >nul
copy js\store.js "%DEST%\js\" >nul
copy js\cards.js "%DEST%\js\" >nul
copy js\avatar.js "%DEST%\js\" >nul
copy js\shell.js "%DEST%\js\" >nul
copy js\stickers.js "%DEST%\js\" >nul

echo 网页文件已同步到 %DEST%
