using System.Runtime.InteropServices;

if (!OperatingSystem.IsWindows())
{
    Console.WriteLine("Windows only; the local reader is accessed via WinSCard/PC-SC.");
    return 2;
}
Console.WriteLine("Cpi Attendance — Windows PC/SC CCID Reader Test 0.1");
Console.WriteLine("Hardware-only diagnostic: no card identity data, photo, logs, storage or network.");
IntPtr context = IntPtr.Zero;
int status = Pcsc.SCardEstablishContext(2, IntPtr.Zero, IntPtr.Zero, out context);
if (status != 0)
{
    Console.WriteLine($"Cannot open Windows Smart Card service: 0x{status:X8}");
    return 1;
}
try
{
    uint required = 0;
    status = Pcsc.SCardListReaders(context, null, null, ref required);
    if (status != 0 || required == 0)
    {
        Console.WriteLine($"Reader list unavailable: 0x{status:X8}");
        return 1;
    }
    char[] buffer = new char[required];
    status = Pcsc.SCardListReaders(context, null, buffer, ref required);
    if (status != 0)
    {
        Console.WriteLine($"Reader enumeration failed: 0x{status:X8}");
        return 1;
    }
    string[] readers = new string(buffer).Split('\0', StringSplitOptions.RemoveEmptyEntries);
    if (readers.Length == 0) { Console.WriteLine("No PC/SC readers connected"); return 1; }
    Console.WriteLine($"Detected {readers.Length} reader(s):");
    foreach (string reader in readers) Console.WriteLine(" • " + reader);
    Console.WriteLine("Place your own contact chip card in the reader before continuing.");
    IntPtr card = IntPtr.Zero;
    status = Pcsc.SCardConnect(context, readers[0], 2, 3, out card, out uint negotiatedProtocol);
    if (status != 0)
    {
        Console.WriteLine($"Card connect failed: 0x{status:X8}. Verify the chip orientation and reader driver.");
        return 1;
    }
    try
    {
        // Raw ATR stays in the local byte array and is deliberately not displayed or stored.
        uint nameSize = 256, atrSize = 64;
        var name = new System.Text.StringBuilder((int)nameSize);
        var atr = new byte[atrSize];
        status = Pcsc.SCardStatus(card, name, ref nameSize, out uint state, out uint protocol, atr, ref atrSize);
        if (status != 0) { Console.WriteLine($"ATR status failed: 0x{status:X8}"); return 1; }
        Console.WriteLine($"Card detected. ATR length: {atrSize} bytes; protocol: {protocol}; state: {state}.");
        Console.WriteLine("PASS means PC/SC communicates with a chip. It does not verify a person's identity.");
        Array.Clear(atr);
        return 0;
    }
    finally { Pcsc.SCardDisconnect(card, 0); }
}
finally { Pcsc.SCardReleaseContext(context); }

internal static class Pcsc
{
    [DllImport("winscard.dll", EntryPoint="SCardEstablishContext")]
    public static extern int SCardEstablishContext(uint scope, IntPtr reserved1, IntPtr reserved2, out IntPtr context);

    [DllImport("winscard.dll", EntryPoint="SCardListReadersW", CharSet=CharSet.Unicode)]
    public static extern int SCardListReaders(IntPtr context, string? groups, [Out] char[]? readers, ref uint length);

    [DllImport("winscard.dll", EntryPoint="SCardConnectW", CharSet=CharSet.Unicode)]
    public static extern int SCardConnect(IntPtr context, string reader, uint shareMode,
        uint preferredProtocols, out IntPtr cardHandle, out uint activeProtocol);

    [DllImport("winscard.dll", EntryPoint="SCardStatusW", CharSet=CharSet.Unicode)]
    public static extern int SCardStatus(IntPtr cardHandle, System.Text.StringBuilder name,
        ref uint readerNameLen, out uint state, out uint protocol, [Out] byte[] atr, ref uint atrLen);

    [DllImport("winscard.dll", EntryPoint="SCardDisconnect")]
    public static extern int SCardDisconnect(IntPtr cardHandle, uint disposition);

    [DllImport("winscard.dll", EntryPoint="SCardReleaseContext")]
    public static extern int SCardReleaseContext(IntPtr context);
}
