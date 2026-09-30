<?php

namespace App\Services;

/**
 * GoWaGatewayService
 *
 * Backward-compatibility wrapper extending WahaGatewayService.
 * Replaces GoWA with WAHA (WhatsApp HTTP API - devlikeapro/waha).
 * All methods (sendText, sendFile, testConnection, sendMessage) are inherited.
 */
class GoWaGatewayService extends WahaGatewayService
{
    // Inherits full WAHA functionality from WahaGatewayService.
}
