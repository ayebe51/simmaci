#!/bin/bash

# Test Teacher Import Endpoint
BASE_URL="http://127.0.0.1:8000/api"

# Login sebagai super admin
echo "=== Login sebagai Super Admin ==="
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
echo "Token: $TOKEN"

# Test import dengan data guru
echo -e "\n=== Test Import Guru ==="
IMPORT_RESPONSE=$(curl -s -X POST "$BASE_URL/teachers/import" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "teachers": [
      {
        "nama": "Test Guru Import 1",
        "nuptk": "1234567890123456",
        "is_certified": false,
        "email": "testguru1@example.com",
        "phone_number": "081234567890"
      },
      {
        "nama": "Test Guru Import 2",
        "nuptk": "9876543210987654",
        "is_certified": true,
        "email": "testguru2@example.com",
        "phone_number": "081234567891"
      }
    ]
  }')

echo "Import Response:"
echo $IMPORT_RESPONSE | python -m json.tool 2>/dev/null || echo $IMPORT_RESPONSE
