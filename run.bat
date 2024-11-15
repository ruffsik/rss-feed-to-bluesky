@echo off

echo - - - - - - - - - - - - - - - - -
echo     Loading ...
echo   %DATE% / %TIME%
echo - - - - - - - - - - - - - - - - -

:run
echo Check feed for posts at %TIME%...

node index.js

echo Wait for 15 minutes (%TIME%)
timeout /t 900 >nul
goto run

