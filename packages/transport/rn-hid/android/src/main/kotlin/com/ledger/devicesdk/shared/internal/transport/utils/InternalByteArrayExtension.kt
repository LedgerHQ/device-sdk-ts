/*
 * SPDX-FileCopyrightText: 2024 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.internal.transport.utils

import com.ledger.devicesdk.shared.api.apdu.ApduParser
import com.ledger.devicesdk.shared.internal.transport.framer.model.ApduFramerHeader

internal fun ByteArray.extractFrameHeader(isUsbTransport: Boolean, parser: ApduParser) =
    ApduFramerHeader(
        channelId = if(isUsbTransport) parser.extract2BytesValue() else null,
        tagId = parser.extractByteValue(),
        frameId = parser.extract2BytesValue(),
    )

internal fun ByteArray.extractApduSize(parser: ApduParser) = parser.extract2BytesValue()