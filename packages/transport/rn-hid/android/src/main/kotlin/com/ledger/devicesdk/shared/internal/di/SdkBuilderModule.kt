/*
 * SPDX-FileCopyrightText: 2024 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.internal.di

import kotlin.time.Duration
import org.koin.core.qualifier.named
import org.koin.dsl.module

internal const val DISCOVERY_TIMEOUT = "DISCOVERY_TIMEOUT"
internal const val CONNECTION_TIMEOUT = "CONNECTION_TIMEOUT"
internal const val ENABLE_FAKE = "ENABLE_FAKE"
internal const val ENABLE_LOG = "ENABLE_LOG"

internal fun sdkBuilderModule(
    discoveryTimeout: Duration,
    connectionTimeout: Duration,
    enableFake: Boolean,
    enableLog: Boolean,
) = module {
    single(named(DISCOVERY_TIMEOUT)) { discoveryTimeout }
    single(named(CONNECTION_TIMEOUT)) { connectionTimeout }
    single(named(ENABLE_FAKE)) { enableFake }
    single(named(ENABLE_LOG)) { enableLog }
}