/*
 * SPDX-FileCopyrightText: 2024 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.internal.coroutine

import kotlin.coroutines.CoroutineContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.cancelChildren

internal val sdkScope: SdkCloseableScope
    get() = getSdkScope()

internal class SdkCloseableScope(
    context: CoroutineContext,
) : CoroutineScope{
    override val coroutineContext: CoroutineContext = context

    override fun toString(): String = "CoroutineScope(context = $coroutineContext)"

    fun close() {
        coroutineContext.cancelChildren()
    }
}