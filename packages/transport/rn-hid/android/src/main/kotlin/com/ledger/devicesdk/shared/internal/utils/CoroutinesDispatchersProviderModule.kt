/*
 * SPDX-FileCopyrightText: 2024 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.internal.utils

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.IO
import org.koin.core.annotation.Factory
import org.koin.core.annotation.Module
import org.koin.core.annotation.Named

internal const val DISPATCHERS_MAIN = "DISPATCHERS_MAIN"
internal const val DISPATCHERS_DEFAULT = "DISPATCHERS_DEFAULT"
internal const val DISPATCHERS_IO = "DISPATCHERS_IO"

@Module
internal class CoroutinesDispatchersProviderModule {
    @Factory
    @Named(DISPATCHERS_MAIN)
    fun provideMainDispatcher() = Dispatchers.Main

    @Factory
    @Named(DISPATCHERS_DEFAULT)
    fun provideDefaultDispatcher() = Dispatchers.Default

    @Factory
    @Named(DISPATCHERS_IO)
    fun provideIODispatcher() = Dispatchers.IO
}