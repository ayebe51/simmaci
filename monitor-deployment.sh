#!/bin/bash

# SK Submission Bugfix - Deployment Monitor
# Usage: ./monitor-deployment.sh

echo "=== SIMMACI Deployment Monitor ==="
echo "Monitoring SK Submission Bugfix Deployment"
echo "Commit: 6f2c488"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if docker is available
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found. Please run this on the server.${NC}"
    exit 1
fi

echo "=== 1. Container Status ==="
docker ps --filter "name=simmaci" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

echo "=== 2. Backend Health Check ==="
BACKEND_RUNNING=$(docker ps --filter "name=simmaci-backend" --filter "status=running" -q)
if [ -n "$BACKEND_RUNNING" ]; then
    echo -e "${GREEN}✓ Backend container is running${NC}"
    
    # Check if Laravel is responding
    docker exec simmaci-backend php artisan --version 2>/dev/null
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Laravel is responding${NC}"
    else
        echo -e "${RED}❌ Laravel not responding${NC}"
    fi
else
    echo -e "${RED}❌ Backend container not running${NC}"
fi
echo ""

echo "=== 3. Recent Backend Logs (Last 20 lines) ==="
docker logs simmaci-backend --tail 20 2>&1 | grep -E "(error|Error|ERROR|exception|Exception|EXCEPTION|failed|Failed|FAILED)" || echo -e "${GREEN}No errors found in recent logs${NC}"
echo ""

echo "=== 4. Laravel Error Logs (Last 10 entries) ==="
docker exec simmaci-backend tail -n 10 storage/logs/laravel.log 2>/dev/null || echo -e "${YELLOW}⚠ Could not read Laravel logs${NC}"
echo ""

echo "=== 5. Database Connection Test ==="
docker exec simmaci-backend php artisan tinker --execute="echo 'DB Connection: ' . (DB::connection()->getPdo() ? 'OK' : 'FAILED');" 2>/dev/null || echo -e "${RED}❌ Database connection test failed${NC}"
echo ""

echo "=== 6. Test Suite Status ==="
echo "Running tests..."
docker exec simmaci-backend php artisan test --filter=SkSubmission 2>&1 | tail -n 5
echo ""

echo "=== 7. Disk Space ==="
df -h | grep -E "(Filesystem|/dev/)" | head -n 2
echo ""

echo "=== Monitor Complete ==="
echo ""
echo "To watch logs in real-time:"
echo "  docker logs -f simmaci-backend"
echo ""
echo "To check Laravel logs:"
echo "  docker exec simmaci-backend tail -f storage/logs/laravel.log"
echo ""
echo "To run full test suite:"
echo "  docker exec simmaci-backend php artisan test"
