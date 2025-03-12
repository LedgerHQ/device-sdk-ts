/*
 * SPDX-FileCopyrightText: 2023 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.api.disconnection

public sealed class DisconnectionResult {
    public data object Success : DisconnectionResult()
}