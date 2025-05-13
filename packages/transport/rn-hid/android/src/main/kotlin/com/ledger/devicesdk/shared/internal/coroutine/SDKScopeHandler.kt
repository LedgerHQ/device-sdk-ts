/*
 * SPDX-FileCopyrightText: 2024 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.internal.coroutine

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

private lateinit var scope: SdkCloseableScope

internal fun getSdkScope(): SdkCloseableScope {
    if (!::scope.isInitialized) {
        scope = SdkCloseableScope(context = Dispatchers.Default + SupervisorJob())
    }
    return scope
}