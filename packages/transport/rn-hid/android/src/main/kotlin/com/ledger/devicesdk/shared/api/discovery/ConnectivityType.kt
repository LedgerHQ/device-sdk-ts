/*
 * SPDX-FileCopyrightText: 2023 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.api.discovery

public sealed class ConnectivityType {
    public data object Usb : ConnectivityType()
}