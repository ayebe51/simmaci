#!/bin/bash

# Script to delete test SK submissions in production
# Usage: ./delete-test-sk.sh [options]

echo "=== Delete Test SK Submissions ==="
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

# Check if backend container is running
BACKEND_RUNNING=$(docker ps --filter "name=simmaci-backend" --filter "status=running" -q)
if [ -z "$BACKEND_RUNNING" ]; then
    echo -e "${RED}❌ Backend container not running${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Backend container is running${NC}"
echo ""

# Show options
echo "Select deletion mode:"
echo "1. Dry-run (show what would be deleted, no actual deletion)"
echo "2. Delete pending test SK (nomor_sk starts with REQ/)"
echo "3. Delete specific SK by nomor_sk"
echo "4. Delete SK created after specific date"
echo ""
read -p "Enter choice (1-4): " choice

case $choice in
    1)
        echo ""
        echo "Running dry-run..."
        docker exec simmaci-backend php artisan sk:delete-test-submissions --dry-run
        ;;
    2)
        echo ""
        echo "This will delete all pending SK with nomor_sk starting with REQ/"
        docker exec simmaci-backend php artisan sk:delete-test-submissions --dry-run
        echo ""
        read -p "Proceed with deletion? (yes/no): " confirm
        if [ "$confirm" = "yes" ]; then
            docker exec simmaci-backend php artisan sk:delete-test-submissions --force
            echo -e "${GREEN}✓ Deletion complete${NC}"
        else
            echo "Deletion cancelled"
        fi
        ;;
    3)
        echo ""
        read -p "Enter nomor_sk to delete: " nomor_sk
        echo ""
        echo "Preview:"
        docker exec simmaci-backend php artisan sk:delete-test-submissions --nomor_sk="$nomor_sk" --dry-run
        echo ""
        read -p "Proceed with deletion? (yes/no): " confirm
        if [ "$confirm" = "yes" ]; then
            docker exec simmaci-backend php artisan sk:delete-test-submissions --nomor_sk="$nomor_sk" --force
            echo -e "${GREEN}✓ Deletion complete${NC}"
        else
            echo "Deletion cancelled"
        fi
        ;;
    4)
        echo ""
        read -p "Enter date (YYYY-MM-DD): " date
        echo ""
        echo "Preview:"
        docker exec simmaci-backend php artisan sk:delete-test-submissions --created-after="$date" --dry-run
        echo ""
        read -p "Proceed with deletion? (yes/no): " confirm
        if [ "$confirm" = "yes" ]; then
            docker exec simmaci-backend php artisan sk:delete-test-submissions --created-after="$date" --force
            echo -e "${GREEN}✓ Deletion complete${NC}"
        else
            echo "Deletion cancelled"
        fi
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo "Done!"
