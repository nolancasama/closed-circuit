@echo off
cd /d "%~dp0"
start "" http://localhost:5181
node serve.js
