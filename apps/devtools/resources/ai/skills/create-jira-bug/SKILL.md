---
# readAnswer in src/main/aiOptions.ts reads the "Ticket:" reply: change both together
name: create-jira-bug
description: File the bug found in a DevTools analysis as a Jira ticket through the Atlassian connector. Use only when the user pressed "Create Jira ticket" in the DevTools.
---

# Creating the Jira bug

The user pressed "Create Jira ticket" after an analysis whose verdict was `Bug:`. File exactly one ticket with the Atlassian connector's `createJiraIssue` tool, then reply with its link. Do not search, edit or comment on other tickets.

## Where

- Site (`cloudId`): `ledgerhq.atlassian.net`
- Project (`projectKey`): `DSDK`
- Issue type (`issueTypeName`): `Bug`
- `contentFormat`: `markdown`
- `additional_fields`: `{"priority": {"name": "<priority>"}, "labels": ["devtools-ai"]}`. The project rejects a ticket without a priority. From the verdict's severity: blocker → `High`, major → `Medium`, minor → `Low`.

## Title

`<Component>: <what goes wrong>`, under 90 characters, for example `signer-eth: provideTokenInformation rejected with 6a80 on Ethereum 1.13.0`.

## Description

Use these sections, from the analysis and the selection you were given:

```
## What happens
<one or two sentences>

## Expected
<what should have happened>

## Where it goes wrong
<time, command and status word of the failing exchange; the cause from the analysis>

## Context
- Device: <model, firmware> · App: <name and version> · Transport: <USB, BLE, mock server…>
- Found with the DMK DevTools AI analysis

## Exchanges
<the relevant lines of the selection in a code block: the failing exchange and the few before it, at most 40 lines; drop repeated getAppAndVersion polls>
```

Leave out anything you do not know rather than guessing. Never put session tokens, seeds or keys in the ticket.

## Reply

After the tool succeeds, reply with one line, `Ticket: <key> <url>` (for example `Ticket: DSDK-1234 https://ledgerhq.atlassian.net/browse/DSDK-1234`). If the tool fails, reply with `Ticket not created: <reason>`.
