/*
 * SPDX-FileCopyrightText: 2024 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.internal.transport.framer.model

internal const val HEADER_SIZE = 5
internal const val CHANNEL_ID_INDEX = 0
internal const val CHANNEL_ID_SIZE = 2
internal const val TAG_ID_INDEX = 2
internal const val FRAME_ID_INDEX = 3
internal const val FRAME_ID_SIZE = 2
internal const val MAXIMUM_HEADER_SIZE = HEADER_SIZE + APDU_SIZE_SIZE