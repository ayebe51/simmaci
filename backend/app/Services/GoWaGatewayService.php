<?php

namespace App\Services;

/**
 * GoWaGatewayService
 *
 * @deprecated Use WahaGatewayService directly. Retained for queue job and backward compatibility.
 * Replaces GoWA with WAHA (WhatsApp HTTP API - devlikeapro/waha).
 * All methods (sendText, sendFile, testConnection, sendMessage) are inherited.
 */
class GoWaGatewayService extends WahaGatewayService
{
    // Inherits full WAHA functionality from WahaGatewayService.
}
