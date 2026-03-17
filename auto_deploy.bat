@echo off
git add .
git commit -m "fix: improve RSS parsing for law-feed"
git push origin main
echo.
echo Done! Check Vercel for deployment status.
pause
