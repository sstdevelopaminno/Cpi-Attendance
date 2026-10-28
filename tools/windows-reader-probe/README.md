# Cpi Attendance — Windows PC/SC reader smoke test

This is an **independent read-only hardware diagnostic**, not a full Windows HR program. It confirms the PC/SC smart-card service can detect an attached Zoweetek/CCID reader and retrieve ATR **length only**.

- Windows 10/11, .NET 8 runtime, Windows Smart Card service enabled.
- Lists recognized PC/SC readers, attempts to connect to a real chip card, prints card state/protocol and ATR byte count only.
- No INTERNET permission, no database or Supabase, no ID number, no card name, no image, no APDU, no file storage.
- The GitHub Actions build runner **does not have real reader hardware**; only a Windows physical test can accept the device.
- Usage: `dotnet run --project tools/windows-reader-probe/CpiAttendance.ReaderProbe.csproj` on the Windows PC with the reader.
- Never make the raw national ID or image the employee primary key. Native Kiosk enrollment/attendance requires a separate device-bound signed assertion and PDPA/legal review.
