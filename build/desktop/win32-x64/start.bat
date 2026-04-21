@echo off
chcp 65001 >nul 2>&1
title 啄木鸟心理预警辅助系统
"%~dp0node\node.exe" "%~dp0desktop\start-desktop.js"
pause
