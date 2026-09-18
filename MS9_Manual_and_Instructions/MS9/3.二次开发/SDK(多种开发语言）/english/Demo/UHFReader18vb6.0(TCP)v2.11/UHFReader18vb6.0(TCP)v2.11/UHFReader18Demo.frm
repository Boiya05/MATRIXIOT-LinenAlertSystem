VERSION 5.00
Begin VB.Form Form1 
   Caption         =   $"UHFReader18Demo.frx":0000
   ClientHeight    =   9180
   ClientLeft      =   60
   ClientTop       =   345
   ClientWidth     =   10185
   LinkTopic       =   "Form1"
   MaxButton       =   0   'False
   ScaleHeight     =   9180
   ScaleWidth      =   10185
   StartUpPosition =   3  '´°¿ÚÈ±Ê¡
   Begin VB.Frame Frame7 
      Caption         =   "TCP"
      Height          =   1335
      Left            =   5400
      TabIndex        =   77
      Top             =   120
      Width           =   4695
      Begin VB.CommandButton Command13 
         Caption         =   "Close"
         Enabled         =   0   'False
         Height          =   375
         Left            =   3000
         TabIndex        =   83
         Top             =   720
         Width           =   1335
      End
      Begin VB.CommandButton Command12 
         Caption         =   "Open"
         Enabled         =   0   'False
         Height          =   375
         Left            =   3000
         TabIndex        =   82
         Top             =   240
         Width           =   1335
      End
      Begin VB.TextBox Text16 
         Height          =   375
         Left            =   1080
         TabIndex        =   81
         Text            =   "6000"
         Top             =   720
         Width           =   1695
      End
      Begin VB.TextBox Text15 
         Height          =   375
         Left            =   1080
         TabIndex        =   79
         Text            =   "192.168.1.192"
         Top             =   240
         Width           =   1695
      End
      Begin VB.Label Label27 
         Caption         =   "Port:"
         Height          =   255
         Left            =   240
         TabIndex        =   80
         Top             =   840
         Width           =   735
      End
      Begin VB.Label Label26 
         Caption         =   "IP address"
         Height          =   255
         Left            =   240
         TabIndex        =   78
         Top             =   360
         Width           =   1215
      End
   End
   Begin VB.OptionButton Option7 
      Caption         =   "TCP"
      Height          =   375
      Left            =   360
      TabIndex        =   76
      Top             =   720
      Width           =   975
   End
   Begin VB.OptionButton Option6 
      Caption         =   "COM"
      Height          =   255
      Left            =   360
      TabIndex        =   75
      Top             =   360
      Value           =   -1  'True
      Width           =   1095
   End
   Begin VB.Frame Frame1 
      Caption         =   "RS232"
      Height          =   1335
      Left            =   1800
      TabIndex        =   66
      Top             =   120
      Width           =   3495
      Begin VB.ComboBox Combo1 
         Height          =   300
         ItemData        =   "UHFReader18Demo.frx":001C
         Left            =   720
         List            =   "UHFReader18Demo.frx":001E
         Style           =   2  'Dropdown List
         TabIndex        =   71
         Top             =   240
         Width           =   975
      End
      Begin VB.TextBox Text1 
         Height          =   270
         Left            =   1320
         TabIndex        =   70
         Text            =   "FF"
         Top             =   600
         Width           =   375
      End
      Begin VB.CommandButton Command1 
         Caption         =   "Open"
         Height          =   375
         Left            =   1800
         TabIndex        =   69
         Top             =   240
         Width           =   1455
      End
      Begin VB.ComboBox Combo2 
         Height          =   300
         Left            =   840
         Style           =   2  'Dropdown List
         TabIndex        =   68
         Top             =   960
         Width           =   855
      End
      Begin VB.CommandButton Command2 
         Caption         =   "Close"
         Height          =   375
         Left            =   1800
         TabIndex        =   67
         Top             =   720
         Width           =   1455
      End
      Begin VB.Label Label1 
         Caption         =   "Port:"
         Height          =   255
         Left            =   120
         TabIndex        =   74
         Top             =   360
         Width           =   495
      End
      Begin VB.Label Label2 
         Caption         =   "ComAddr:"
         Height          =   255
         Left            =   120
         TabIndex        =   73
         Top             =   720
         Width           =   1335
      End
      Begin VB.Label Label3 
         Caption         =   "Baudrate:"
         Height          =   255
         Left            =   120
         TabIndex        =   72
         Top             =   1080
         Width           =   855
      End
   End
   Begin VB.Frame Frame6 
      Caption         =   "Status"
      Height          =   855
      Left            =   120
      TabIndex        =   43
      Top             =   8160
      Width           =   9975
      Begin VB.Label Label18 
         Height          =   375
         Left            =   240
         TabIndex        =   44
         Top             =   240
         Width           =   7215
      End
   End
   Begin VB.Frame Frame5 
      Caption         =   "Query Tag"
      Height          =   4335
      Left            =   5040
      TabIndex        =   37
      Top             =   3840
      Width           =   5055
      Begin VB.TextBox Text14 
         BackColor       =   &H80000004&
         Height          =   375
         Left            =   840
         Locked          =   -1  'True
         TabIndex        =   64
         Top             =   3840
         Width           =   1815
      End
      Begin VB.CommandButton Command11 
         Caption         =   "Write"
         Enabled         =   0   'False
         Height          =   375
         Left            =   3840
         TabIndex        =   62
         Top             =   3840
         Width           =   1095
      End
      Begin VB.CommandButton Command10 
         Caption         =   "Read"
         Enabled         =   0   'False
         Height          =   375
         Left            =   2760
         TabIndex        =   61
         Top             =   3840
         Width           =   975
      End
      Begin VB.ComboBox Combo10 
         Height          =   300
         ItemData        =   "UHFReader18Demo.frx":0020
         Left            =   3960
         List            =   "UHFReader18Demo.frx":0030
         Style           =   2  'Dropdown List
         TabIndex        =   59
         Top             =   3360
         Width           =   975
      End
      Begin VB.TextBox Text13 
         Height          =   390
         Left            =   2880
         TabIndex        =   58
         Text            =   "0000"
         Top             =   3360
         Width           =   975
      End
      Begin VB.TextBox Text12 
         Height          =   390
         Left            =   960
         MaxLength       =   8
         TabIndex        =   56
         Text            =   "00000000"
         Top             =   3360
         Width           =   975
      End
      Begin VB.TextBox Text11 
         Height          =   390
         Left            =   2880
         MaxLength       =   2
         TabIndex        =   54
         Text            =   "04"
         Top             =   2880
         Width           =   975
      End
      Begin VB.TextBox Text10 
         Height          =   390
         Left            =   960
         MaxLength       =   2
         TabIndex        =   52
         Text            =   "00"
         Top             =   2880
         Width           =   975
      End
      Begin VB.ComboBox Combo9 
         Height          =   300
         Left            =   120
         Style           =   2  'Dropdown List
         TabIndex        =   50
         Top             =   2520
         Width           =   4815
      End
      Begin VB.CommandButton Command6 
         Caption         =   "Clear"
         Height          =   375
         Left            =   3480
         TabIndex        =   41
         Top             =   2040
         Width           =   1455
      End
      Begin VB.CommandButton Command5 
         Caption         =   "Stop"
         Enabled         =   0   'False
         Height          =   375
         Left            =   1800
         TabIndex        =   40
         Top             =   2040
         Width           =   1575
      End
      Begin VB.CommandButton Command4 
         Caption         =   "Inventory"
         Enabled         =   0   'False
         Height          =   375
         Left            =   120
         TabIndex        =   39
         Top             =   2040
         Width           =   1575
      End
      Begin VB.ListBox List1 
         Height          =   1680
         Left            =   120
         TabIndex        =   38
         Top             =   240
         Width           =   4815
      End
      Begin VB.Label Label25 
         Caption         =   "Readdata:"
         Height          =   255
         Left            =   120
         TabIndex        =   63
         Top             =   3960
         Width           =   855
      End
      Begin VB.Label Label24 
         Caption         =   "Memory"
         Height          =   255
         Left            =   3960
         TabIndex        =   60
         Top             =   3120
         Width           =   975
      End
      Begin VB.Label Label23 
         Caption         =   "WriteData"
         Height          =   255
         Left            =   2040
         TabIndex        =   57
         Top             =   3480
         Width           =   975
      End
      Begin VB.Label Label22 
         Caption         =   "Password:"
         Height          =   255
         Left            =   120
         TabIndex        =   55
         Top             =   3480
         Width           =   975
      End
      Begin VB.Label Label21 
         Caption         =   "Length:"
         Height          =   255
         Left            =   2040
         TabIndex        =   53
         Top             =   3000
         Width           =   975
      End
      Begin VB.Label Label20 
         Caption         =   "Address:"
         Height          =   255
         Left            =   120
         TabIndex        =   51
         Top             =   3000
         Width           =   975
      End
   End
   Begin VB.Frame Frame3 
      Caption         =   "Parameter"
      Height          =   4335
      Left            =   120
      TabIndex        =   18
      Top             =   3840
      Width           =   4815
      Begin VB.CommandButton Command7 
         Caption         =   "Set"
         Enabled         =   0   'False
         Height          =   375
         Left            =   2760
         TabIndex        =   45
         Top             =   3720
         Width           =   1935
      End
      Begin VB.Timer Timer1 
         Enabled         =   0   'False
         Interval        =   50
         Left            =   2760
         Top             =   2160
      End
      Begin VB.CheckBox Check3 
         Caption         =   "single"
         Height          =   375
         Left            =   120
         TabIndex        =   36
         Top             =   3720
         Width           =   4215
      End
      Begin VB.ComboBox Combo7 
         Height          =   300
         Left            =   3840
         TabIndex        =   35
         Text            =   "Combo7"
         Top             =   3240
         Width           =   855
      End
      Begin VB.ComboBox Combo6 
         Height          =   300
         Left            =   1440
         Style           =   2  'Dropdown List
         TabIndex        =   34
         Top             =   3240
         Width           =   855
      End
      Begin VB.Frame Frame4 
         Caption         =   "Band"
         Height          =   1935
         Left            =   120
         TabIndex        =   27
         Top             =   1200
         Width           =   4575
         Begin VB.OptionButton Option5 
            Caption         =   "EU band"
            Height          =   375
            Left            =   120
            TabIndex        =   65
            Top             =   1440
            Width           =   1335
         End
         Begin VB.OptionButton Option4 
            Caption         =   "Korean band"
            Height          =   375
            Left            =   120
            TabIndex        =   31
            Top             =   1080
            Width           =   1335
         End
         Begin VB.OptionButton Option3 
            Caption         =   "US band"
            Height          =   255
            Left            =   120
            TabIndex        =   30
            Top             =   840
            Width           =   1575
         End
         Begin VB.OptionButton Option2 
            Caption         =   "Chinese band2"
            Height          =   375
            Left            =   120
            TabIndex        =   29
            Top             =   480
            Width           =   1575
         End
         Begin VB.OptionButton Option1 
            Caption         =   "User band"
            Height          =   255
            Left            =   120
            TabIndex        =   28
            Top             =   240
            Width           =   1335
         End
      End
      Begin VB.ComboBox Combo5 
         Height          =   300
         Left            =   3840
         Style           =   2  'Dropdown List
         TabIndex        =   26
         Top             =   720
         Width           =   855
      End
      Begin VB.ComboBox Combo4 
         Height          =   300
         ItemData        =   "UHFReader18Demo.frx":004E
         Left            =   720
         List            =   "UHFReader18Demo.frx":00AF
         Style           =   2  'Dropdown List
         TabIndex        =   24
         Top             =   720
         Width           =   975
      End
      Begin VB.ComboBox Combo3 
         Height          =   300
         Left            =   2880
         Style           =   2  'Dropdown List
         TabIndex        =   22
         Top             =   240
         Width           =   1815
      End
      Begin VB.TextBox Text8 
         Height          =   390
         Left            =   1320
         TabIndex        =   20
         Top             =   240
         Width           =   615
      End
      Begin VB.Label Label17 
         Caption         =   "MaxFre:"
         Height          =   255
         Left            =   2520
         TabIndex        =   33
         Top             =   3360
         Width           =   1335
      End
      Begin VB.Label Label16 
         Caption         =   "MinFre:"
         Height          =   255
         Left            =   120
         TabIndex        =   32
         Top             =   3360
         Width           =   1455
      End
      Begin VB.Label Label15 
         Caption         =   "Max scan time:"
         Height          =   255
         Left            =   2400
         TabIndex        =   25
         Top             =   840
         Width           =   1335
      End
      Begin VB.Label Label14 
         Caption         =   "Power:"
         Height          =   255
         Left            =   120
         TabIndex        =   23
         Top             =   840
         Width           =   615
      End
      Begin VB.Label Label13 
         Caption         =   "baudrate:"
         Height          =   255
         Left            =   2040
         TabIndex        =   21
         Top             =   360
         Width           =   975
      End
      Begin VB.Label Label12 
         Caption         =   "Address(HEX):"
         Height          =   255
         Left            =   120
         TabIndex        =   19
         Top             =   360
         Width           =   1215
      End
   End
   Begin VB.Frame Frame2 
      Caption         =   "Reader Information"
      Height          =   2295
      Left            =   120
      TabIndex        =   0
      Top             =   1560
      Width           =   9975
      Begin VB.ComboBox Combo8 
         Height          =   300
         ItemData        =   "UHFReader18Demo.frx":0125
         Left            =   1080
         List            =   "UHFReader18Demo.frx":0135
         Style           =   2  'Dropdown List
         TabIndex        =   49
         Top             =   1800
         Width           =   3015
      End
      Begin VB.CommandButton Command9 
         Caption         =   "Get"
         Enabled         =   0   'False
         Height          =   375
         Left            =   5880
         TabIndex        =   47
         Top             =   1800
         Width           =   1455
      End
      Begin VB.CommandButton Command8 
         Caption         =   "Set"
         Enabled         =   0   'False
         Height          =   375
         Left            =   4200
         TabIndex        =   46
         Top             =   1800
         Width           =   1455
      End
      Begin VB.TextBox Text9 
         BackColor       =   &H8000000B&
         Height          =   375
         Left            =   6240
         Locked          =   -1  'True
         TabIndex        =   42
         Top             =   840
         Width           =   1935
      End
      Begin VB.CommandButton Command3 
         Caption         =   "Get info"
         Enabled         =   0   'False
         Height          =   375
         Left            =   5880
         TabIndex        =   17
         Top             =   1320
         Width           =   1815
      End
      Begin VB.TextBox Text7 
         BackColor       =   &H8000000A&
         Height          =   375
         Left            =   4200
         Locked          =   -1  'True
         TabIndex        =   16
         Top             =   1320
         Width           =   1215
      End
      Begin VB.TextBox Text6 
         BackColor       =   &H8000000B&
         Height          =   375
         Left            =   1440
         Locked          =   -1  'True
         TabIndex        =   14
         Top             =   1320
         Width           =   1215
      End
      Begin VB.TextBox Text5 
         BackColor       =   &H8000000B&
         Height          =   375
         Left            =   3120
         Locked          =   -1  'True
         TabIndex        =   11
         Top             =   840
         Width           =   1335
      End
      Begin VB.TextBox Text4 
         BackColor       =   &H8000000B&
         Height          =   375
         Left            =   600
         Locked          =   -1  'True
         TabIndex        =   9
         Top             =   840
         Width           =   1335
      End
      Begin VB.CheckBox Check2 
         Caption         =   "EPCC1-G2"
         Height          =   255
         Left            =   7920
         TabIndex        =   8
         Top             =   360
         Width           =   1455
      End
      Begin VB.CheckBox Check1 
         Caption         =   "ISO18000-6B"
         Height          =   255
         Left            =   6240
         TabIndex        =   7
         Top             =   360
         Width           =   1575
      End
      Begin VB.TextBox Text3 
         BackColor       =   &H8000000B&
         Height          =   375
         Left            =   3120
         Locked          =   -1  'True
         TabIndex        =   5
         Top             =   300
         Width           =   1335
      End
      Begin VB.TextBox Text2 
         BackColor       =   &H8000000B&
         Height          =   375
         Left            =   600
         Locked          =   -1  'True
         TabIndex        =   3
         Top             =   300
         Width           =   1335
      End
      Begin VB.Label Label19 
         Caption         =   "Mode:"
         Height          =   255
         Left            =   120
         TabIndex        =   48
         Top             =   1920
         Width           =   975
      End
      Begin VB.Label Label11 
         Caption         =   "MaxFre:"
         Height          =   255
         Left            =   2760
         TabIndex        =   15
         Top             =   1440
         Width           =   1215
      End
      Begin VB.Label Label10 
         Caption         =   "MinFre:"
         Height          =   255
         Left            =   120
         TabIndex        =   13
         Top             =   1440
         Width           =   1335
      End
      Begin VB.Label Label9 
         Caption         =   "Max scan time :"
         Height          =   255
         Left            =   4920
         TabIndex        =   12
         Top             =   960
         Width           =   2055
      End
      Begin VB.Label Label8 
         Caption         =   "Power:"
         Height          =   255
         Left            =   2280
         TabIndex        =   10
         Top             =   960
         Width           =   615
      End
      Begin VB.Label Label7 
         Caption         =   "Protocol:"
         Height          =   255
         Left            =   4920
         TabIndex        =   6
         Top             =   360
         Width           =   855
      End
      Begin VB.Label Label6 
         Caption         =   "Version:"
         Height          =   255
         Left            =   2280
         TabIndex        =   4
         Top             =   360
         Width           =   855
      End
      Begin VB.Label Label5 
         Caption         =   "Address:"
         Height          =   255
         Left            =   120
         TabIndex        =   2
         Top             =   960
         Width           =   495
      End
      Begin VB.Label Label4 
         Caption         =   "Type:"
         Height          =   255
         Left            =   120
         TabIndex        =   1
         Top             =   360
         Width           =   855
      End
   End
End
Attribute VB_Name = "Form1"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Dim FrmHabdle As Long
Dim ComAdr As Byte
Dim fCmdRet As Long
Dim fdminfre As Single
Dim fdmaxfre As Single
Dim fIsInventoryScan As Boolean
Dim fcloseApp As Boolean
Dim EPClist As String

Private Sub Check3_Click()
If Check3.Value = 1 Then
    Combo7.ListIndex = Combo6.ListIndex
End If
End Sub

Private Sub Command1_Click()
Dim Port As Long
Dim Baud As Byte
Dim str As String
Dim TrType(2) As Byte
Dim VersionInfo(2) As Byte
Dim ReaderType, ScanTime, dmaxfre, dminfre, PowerDbm, FreBand, Accuracy As Byte
ComAdr = &HFF
Port = Combo1.ListIndex + 1
Baud = Combo2.ListIndex
If Baud > 2 Then
Baud = Baud + 2
End If
FrmHandle = -1
Label18.Caption = ""
Combo4.Clear
fCmdRet = OpenComPort(Port, ComAdr, Baud, FrmHabdle)
If (fCmdRet = 0) Then
fCmdRet = GetReaderInformation(ComAdr, VersionInfo(0), ReaderType, TrType(0), dmaxfre, dminfre, PowerDbm, ScanTime, FrmHabdle)
If (fCmdRet = 0) Then
Text3.Text = GetValue(VersionInfo(0)) + "." + GetValue(VersionInfo(1))
 If (VersionInfo(1) >= 30) Then
    For i = 0 To 30
    str = Val(i)
    Combo4.AddItem (str)
    Next i
    Combo4.ListIndex = 30
  Else
    For i = 0 To 18
     str = Val(i)
    Combo4.AddItem (str)
    Next i
    Combo4.ListIndex = 18
 End If
 Text4.Text = GetHexValue(ComAdr)
 Text8.Text = GetHexValue(ComAdr)
  str = GetValue(ScanTime)
Text9.Text = str + "*100ms"
index = ScanTime - 3
  Combo5.ListIndex = index
  str = Val(PowerDbm)
  Text5.Text = str
  Combo4.ListIndex = PowerDbm
FreBand = CByte(((dmaxfre And &HC0) \ 16) Or (dminfre \ 64))
Select Case FreBand
Case 0
         Option1.Value = True
         fdminfre = 902.6 + (dminfre And &H3F) * 0.4
         fdmaxfre = 902.6 + (dmaxfre And &H3F) * 0.4
Case 1
         Option2.Value = True
         fdminfre = 920.125 + (dminfre And &H3F) * 0.25
         fdmaxfre = 920.125 + (dmaxfre And &H3F) * 0.25
 Case 2
         Option3.Value = True
         fdminfre = 902.75 + (dminfre And &H3F) * 0.5
         fdmaxfre = 902.75 + (dmaxfre And &H3F) * 0.5
Case 3
         Option4.Value = True
         fdminfre = 917.1 + (dminfre And &H3F) * 0.2
         fdmaxfre = 917.1 + (dmaxfre And &H3F) * 0.2
Case 4
         Option5.Value = True
         fdminfre = 865.1 + (dminfre And &H3F) * 0.2
         fdmaxfre = 865.1 + (dmaxfre And &H3F) * 0.2
 End Select
  Text6.Text = CStr(fdminfre) + "MHz"
  Text7.Text = CStr(fdmaxfre) + "MHz"
  If fdmaxfre <> fdminfre Then
  Check3.Value = 0
  End If
  Combo6.ListIndex = dminfre And &H3F
  Combo7.ListIndex = dmaxfre And &H3F
 Select Case ReaderType
      Case 6
           Text2.Text = ""
      Case 3
           Text2.Text = ""
      Case 9
           Text2.Text = "UHFReader18"
 End Select
    If (TrType(0) And &H2) = &H2 Then
    Check1.Value = 1
    Check2.Value = 1
    Else
    Check1.Value = 0
    Check2.Value = 0
    End If
Label18.Caption = "Get reader infomation success!"
End If
Command3.Enabled = True
Command4.Enabled = True
Command7.Enabled = True
Command8.Enabled = True
Command9.Enabled = True
Command10.Enabled = True
Command11.Enabled = True
Label18.Caption = "Open Success"
Else
Label18.Caption = "Open Failed"
End If

End Sub
Function GetHexData(ByRef uBuff() As Byte, ByVal count As Long) As String
Dim GetData, GetBuff As String
Dim i As Long
GetData = ""
For i = 0 To count - 1
If uBuff(i) < 16 Then
GetBuff = "0" & Hex(uBuff(i))
Else
GetBuff = Hex(uBuff(i))
End If
GetData = GetData + GetBuff
Next i
GetHexData = GetData
End Function
Function GetHexValue(ByVal uBuff As Byte) As String
Dim GetData As String
Dim i As Long
If uBuff < 16 Then
GetData = "0" & Hex(uBuff)
Else
GetData = Hex(uBuff)
End If
GetHexValue = GetData
End Function
Function GetValue(ByVal uBuff As Byte) As String
Dim GetData As String
Dim i As Long
If uBuff < 10 Then
GetData = "0" & Val(uBuff)
Else
GetData = Val(uBuff)
End If
GetValue = GetData
End Function


Private Sub Command10_Click()
  Dim Mem, Num, WordPtr As Byte
  Dim EPClength, maskFlag, maskadr, maskLen As Byte
  Dim i As Integer
  Dim s2 As String
  Dim CardData(320) As Byte
  Dim fOperEPC(320) As Byte
  Dim fPassword(4) As Byte
  Dim temp As String
   If (Text10.Text = "") Or (Text11.Text = "") Then
      Exit Sub
End If
Text14.Text = ""
      If (Len(Text12.Text) < 8) Then
      MsgBox "Passwor length < 8!"
      Exit Sub
      End If
      maskFlag = 0
      maskadr = 0
      maskLen = 0
      For i = 0 To Len(Combo9.Text) / 2 - 1
      fOperEPC(i) = Val("&H" + Mid(Combo9.Text, i * 2 + 1, 2))
      Next i
      
      For i = 0 To 3
      fPassword(i) = Val("&H" + Mid(Text12.Text, i * 2 + 1, 2))
      Next i
      WordPtr = Val("&H" + Text10.Text)
      Num = Val("&H" + Text11.Text)
      Mem = Combo10.ListIndex
      EPClength = Len(Combo9.Text) / 2
      fCmdRet = ReadCard_G2(ComAdr, fOperEPC(0), Mem, WordPtr, Num, fPassword(0), maskadr, maskLen, maskFlag, CardData(0), EPClength, ferrorcode, FrmHabdle)
      If (fCmdRet = 0) Then
      temp = GetHexData(CardData(), Num * 2)
      temp = UCase(temp)
      Text14.Text = temp
      Label18.Caption = "Read success!"
      Else
      Label18.Caption = "Read failed!"
      End If
End Sub

Private Sub Command11_Click()
 Dim Mem, Writedatalen, WordPtr As Byte
  Dim EPClength, maskFlag, maskadr, maskLen As Byte
  Dim i As Integer
  Dim s2 As String
  Dim CardData(320) As Byte
  Dim fOperEPC(320) As Byte
  Dim fPassword(4) As Byte
  Dim temp As String
  Dim WritedataNum As Long
   If (Text10.Text = "") Or (Text11.Text = "") Then
      Exit Sub
End If
Text14.Text = ""
      If (Len(Text12.Text) < 8) Then
      MsgBox "Password length<8!"
      Exit Sub
      End If
      If (Len(Text13.Text) Mod 4 <> 0) Then
      MsgBox "Input by word ,such as: 1234,12345678!"
      Exit Sub
      End If
      maskFlag = 0
      maskadr = 0
      maskLen = 0
      For i = 0 To Len(Combo9.Text) / 2 - 1
      fOperEPC(i) = Val("&H" + Mid(Combo9.Text, i * 2 + 1, 2))
      Next i
      For i = 0 To Len(Text13.Text) / 2 - 1
      CardData(i) = Val("&H" + Mid(Text13.Text, i * 2 + 1, 2))
      Next i
      Writedatalen = Len(Text13.Text) / 2
      For i = 0 To 3
      fPassword(i) = Val("&H" + Mid(Text12.Text, i * 2 + 1, 2))
      Next i
      WordPtr = Val("&H" + Text10.Text)
      Mem = Combo10.ListIndex
      EPClength = Len(Combo9.Text) / 2
      fCmdRet = WriteCard_G2(ComAdr, fOperEPC(0), Mem, WordPtr, Writedatalen, CardData(0), fPassword(0), maskadr, maskLen, maskFlag, WritedataNum, EPClength, ferrorcode, FrmHabdle)
      If (fCmdRet = 0) Then
      Label18.Caption = "Write success!"
      Else
      Label18.Caption = "write failed!"
      End If
End Sub

Private Sub Command12_Click()
Dim Port As Long
Dim Baud As Byte
Dim str As String
Dim TrType(2) As Byte
Dim VersionInfo(2) As Byte
Dim ipp As String
Dim ReaderType, ScanTime, dmaxfre, dminfre, PowerDbm, FreBand, Accuracy As Byte
ComAdr = &HFF
Port = Combo1.ListIndex + 1
Baud = Combo2.ListIndex
If Baud > 2 Then
Baud = Baud + 2
End If
If (Text15.Text = "") Or (Text16.Text = "") Then
Exit Sub
End If
Port = Val(Text16.Text)
ipp = Text15.Text
FrmHandle = -1
Label18.Caption = ""
Combo4.Clear
fCmdRet = &H30
fCmdRet = OpenNetPort(Port, ipp, ComAdr, FrmHabdle)
If (fCmdRet = 0) Then
fCmdRet = GetReaderInformation(ComAdr, VersionInfo(0), ReaderType, TrType(0), dmaxfre, dminfre, PowerDbm, ScanTime, FrmHabdle)
If (fCmdRet = 0) Then
Text3.Text = GetValue(VersionInfo(0)) + "." + GetValue(VersionInfo(1))
 If (VersionInfo(1) >= 30) Then
    For i = 0 To 30
    str = Val(i)
    Combo4.AddItem (str)
    Next i
    Combo4.ListIndex = 30
  Else
    For i = 0 To 18
     str = Val(i)
    Combo4.AddItem (str)
    Next i
    Combo4.ListIndex = 18
 End If
 Text4.Text = GetHexValue(ComAdr)
 Text8.Text = GetHexValue(ComAdr)
  str = GetValue(ScanTime)
Text9.Text = str + "*100ms"
index = ScanTime - 3
  Combo5.ListIndex = index
  str = Val(PowerDbm)
  Text5.Text = str
  Combo4.ListIndex = PowerDbm
FreBand = CByte(((dmaxfre And &HC0) \ 16) Or (dminfre \ 64))
Select Case FreBand
Case 0
         Option1.Value = True
         fdminfre = 902.6 + (dminfre And &H3F) * 0.4
         fdmaxfre = 902.6 + (dmaxfre And &H3F) * 0.4
Case 1
         Option2.Value = True
         fdminfre = 920.125 + (dminfre And &H3F) * 0.25
         fdmaxfre = 920.125 + (dmaxfre And &H3F) * 0.25
 Case 2
         Option3.Value = True
         fdminfre = 902.75 + (dminfre And &H3F) * 0.5
         fdmaxfre = 902.75 + (dmaxfre And &H3F) * 0.5
Case 3
         Option4.Value = True
         fdminfre = 917.1 + (dminfre And &H3F) * 0.2
         fdmaxfre = 917.1 + (dmaxfre And &H3F) * 0.2
Case 4
         Option5.Value = True
         fdminfre = 865.1 + (dminfre And &H3F) * 0.2
         fdmaxfre = 865.1 + (dmaxfre And &H3F) * 0.2
 End Select
  Text6.Text = CStr(fdminfre) + "MHz"
  Text7.Text = CStr(fdmaxfre) + "MHz"
  If fdmaxfre <> fdminfre Then
  Check3.Value = 0
  End If
  Combo6.ListIndex = dminfre And &H3F
  Combo7.ListIndex = dmaxfre And &H3F
 Select Case ReaderType
      Case 6
           Text2.Text = ""
      Case 3
           Text2.Text = ""
      Case 9
           Text2.Text = "UHFReader18"
 End Select
    If (TrType(0) And &H2) = &H2 Then
    Check1.Value = 1
    Check2.Value = 1
    Else
    Check1.Value = 0
    Check2.Value = 0
    End If
Label18.Caption = "Get reader information seccess!"
End If
Command3.Enabled = True
Command4.Enabled = True
Command7.Enabled = True
Command8.Enabled = True
Command9.Enabled = True
Command10.Enabled = True
Command11.Enabled = True
Label18.Caption = "Open success"
Else
Label18.Caption = "Open failed"
End If
End Sub

Private Sub Command13_Click()
     Timer1.Enabled = False
      If (FrmHabdle > 1023) Then
        fCmdRet = CloseNetPort(FrmHabdle)
     End If
     If fCmdRet = 0 Then
        Label18.Caption = "Close success!"
        Label18.Caption = ""
        Text2.Text = ""
        Text3.Text = ""
        Text4.Text = ""
        Text5.Text = ""
        Text6.Text = ""
        Text7.Text = ""
        Text9.Text = ""
        Check1.Value = 0
        Check2.Value = 0
        Command3.Enabled = False
        Command4.Enabled = False
        Command5.Enabled = False
        Command7.Enabled = False
        Command8.Enabled = False
        Command9.Enabled = False
        Command10.Enabled = False
        Command11.Enabled = False
     Else
        Label18.Caption = "Close failed!"
     End If
End Sub

Private Sub Command2_Click()
Timer1.Enabled = False
fCmdRet = CloseComPort()
If fCmdRet = 0 Then
Label18.Caption = "Close success!"
Label18.Caption = ""
Text2.Text = ""
Text3.Text = ""
Text4.Text = ""
Text5.Text = ""
Text6.Text = ""
Text7.Text = ""
Text9.Text = ""
Check1.Value = 0
Check2.Value = 0
Command3.Enabled = False
Command4.Enabled = False
Command5.Enabled = False
Command7.Enabled = False
Command8.Enabled = False
Command9.Enabled = False
Command10.Enabled = False
Command11.Enabled = False
Else
Label18.Caption = "Close failed!"
End If
End Sub

Private Sub Command3_Click()
Dim TrType(2) As Byte
Dim VersionInfo(2) As Byte
Dim ReaderType, ScanTime, dmaxfre, dminfre, PowerDbm, FreBand, Accuracy As Byte
Dim str As String
Dim index As Long
Label18.Caption = ""
Text2.Text = ""
Text3.Text = ""
Text4.Text = ""
Text5.Text = ""
Text6.Text = ""
Text7.Text = ""
Text9.Text = ""
Check1.Value = 0
Check2.Value = 0
Combo4.Clear
fCmdRet = GetReaderInformation(ComAdr, VersionInfo(0), ReaderType, TrType(0), dmaxfre, dminfre, PowerDbm, ScanTime, FrmHabdle)
If (fCmdRet = 0) Then
Text3.Text = GetValue(VersionInfo(0)) + "." + GetValue(VersionInfo(1))
 If (VersionInfo(1) >= 30) Then
    For i = 0 To 30
    str = Val(i)
    Combo4.AddItem (str)
    Next i
    Combo4.ListIndex = 30
  Else
    For i = 0 To 18
     str = Val(i)
    Combo4.AddItem (str)
    Next i
    Combo4.ListIndex = 18
 End If
 Text4.Text = GetHexValue(ComAdr)
 Text8.Text = GetHexValue(ComAdr)
  str = GetValue(ScanTime)
Text9.Text = str + "*100ms"
index = ScanTime - 3
  Combo5.ListIndex = index
  str = Val(PowerDbm)
  Text5.Text = str
  Combo4.ListIndex = PowerDbm
FreBand = CByte(((dmaxfre And &HC0) \ 16) Or (dminfre \ 64))
Select Case FreBand
Case 0
        Option1.Value = True
        fdminfre = 902.6 + (dminfre And &H3F) * 0.4
        fdmaxfre = 902.6 + (dmaxfre And &H3F) * 0.4
Case 1
        Option2.Value = True
        fdminfre = 920.125 + (dminfre And &H3F) * 0.25
        fdmaxfre = 920.125 + (dmaxfre And &H3F) * 0.25
Case 2
        Option3.Value = True
        fdminfre = 902.75 + (dminfre And &H3F) * 0.5
        fdmaxfre = 902.75 + (dmaxfre And &H3F) * 0.5
Case 3
        Option4.Value = True
        fdminfre = 917.1 + (dminfre And &H3F) * 0.2
        fdmaxfre = 917.1 + (dmaxfre And &H3F) * 0.2
Case 4
        Option5.Value = True
        fdminfre = 865.1 + (dminfre And &H3F) * 0.2
        fdmaxfre = 865.1 + (dmaxfre And &H3F) * 0.2
End Select
  Text6.Text = CStr(fdminfre) + "MHz"
  Text7.Text = CStr(fdmaxfre) + "MHz"
  If fdmaxfre <> fdminfre Then
  Check3.Value = 0
  End If
  Combo6.ListIndex = CByte(dminfre And &H3F)
  Combo7.ListIndex = CByte(dmaxfre And &H3F)
 Select Case ReaderType
 Case 6
     Text2.Text = ""
 Case 3
     Text2.Text = ""
 Case 9
     Text2.Text = "UHFReader18"
 End Select
    If (TrType(0) And &H2) = &H2 Then
    Check1.Value = 1
    Check2.Value = 1
    Else
    Check1.Value = 0
    Check2.Value = 0
    End If
Label18.Caption = "Get Reader Information success!"
Else
Label18.Caption = "Get Reader Information failed!"
End If
End Sub
Function Inventory() As Long
Dim CardNum As Long
Dim index As Long
Dim EPCflag As Boolean
        Dim Totallen As Long
        Dim EPClen, m As Long
        Dim EPC(5000) As Byte
        Dim CardIndex As Long
        Dim temps As String
         Dim AdrTID As Byte
        Dim LenTID As Byte
        Dim TIDFlag As Byte
        Dim s, sEPC As String
        Dim isonlistview As Boolean
        Dim ScanModeData(5000) As Byte
        Dim ValidDatalength As Long
         AdrTID = 0
        LenTID = 0
        TIDFlag = 0
         If (Combo8.ListIndex = 0) Then
            EPCflag = False
           fCmdRet = Inventory_G2(ComAdr, AdrTID, LenTID, TIDFlag, EPC(0), Totallen, CardNum, FrmHabdle)
             If ((fCmdRet = 1) Or (fCmdRet = 2) Or (fCmdRet = 3) Or (fCmdRet = 4) Or (fCmdRet = &HFB)) Then
                temps = GetHexData(EPC, Totallen)
                fInventory_EPC_List = temps
                m = 1
        
                If (CardNum = 0) Then
                    fIsInventoryScan = False
                    Exit Function
                End If
                For CardIndex = 0 To CardNum - 1
                If (fcloseApp) Then
                Exit For
                End If
                    EPCflag = False
                    EPClen = EPC(m - 1)
                    sEPC = Mid(temps, m * 2 + 1, EPClen * 2)
                    m = m + EPClen + 1
                    If (Len(sEPC) <> EPClen * 2) Then
                        Exit Function
                    End If
                    For index = 0 To Combo9.ListCount
                    If (Combo9.List(index) = sEPC) Then
                    EPCflag = True
                    End If
                    Next index
                    If (EPCflag = False) Then
                    Combo9.AddItem (sEPC)
                    End If
                    List1.AddItem (sEPC)
                
                Next CardIndex
            End If
            If (List1.ListCount > 0) Then
            List1.ListIndex = List1.ListCount - 1
            Combo9.ListIndex = 0
            End If
        Else
        fCmdRet = ReadActiveModeData(ScanModeData(0), ValidDatalength, FrmHabdle)
        If (ValidDatalength > 0) Then
        temps = GetHexData(ScanModeData, ValidDatalength)
        List1.AddItem (temps)
        End If
         If (List1.ListCount > 0) Then
            List1.ListIndex = List1.ListCount - 1
            End If
        End If
        fIsInventoryScan = False
        If (fcloseApp) Then
            Close
        End If
End Function

Private Sub Command4_Click()
Timer1.Enabled = True
Command5.Enabled = True
Command4.Enabled = False
End Sub

Private Sub Command5_Click()
Timer1.Enabled = False
Command4.Enabled = True
Command5.Enabled = False
End Sub

Private Sub Command6_Click()
List1.Clear
End Sub

Private Sub Command7_Click()
  Dim aNewComAdr, PowerDbm, dminfre, dmaxfre, ScanTime, band As Byte
  Dim fBaud As Byte
        Dim returninfo As String
        Dim returninfoDlg As String
        Dim setinfo As String
        setinfo = ""
        returninfoDlg = ""
        returninfo = ""
        Label18.Caption = ""
        If (Option1.Value = True) Then
            band = 0
        End If
        If (Option2.Value = True) Then
            band = 1
        End If
        If (Option3.Value = True) Then
            band = 2
        End If
        If (Option4.Value = True) Then
            band = 3
        End If
         If (Option5.Value = True) Then
            band = 4
        End If
        If (Text8.Text = "") Then
            Exit Sub
        End If
        dminfre = CByte(((band And 3) * 64) Or (Combo6.ListIndex And &H3F))
        dmaxfre = CByte(((band And &HC) * 16) Or (Combo7.ListIndex And &H3F))
        aNewComAdr = CByte(Text8.Text)
        PowerDbm = CByte(Combo4.ListIndex)
        fBaud = CByte(Combo3.ListIndex)
        If (fBaud > 2) Then
            fBaud = CByte(fBaud + 2)
        End If
        ScanTime = CByte(Combo5.ListIndex + 3)
        setinfo = "Write"
       fCmdRet = WriteComAdr(ComAdr, aNewComAdr, FrmHabdle)
        If (fCmdRet = &H13) Then
            fComAdr = aNewComAdr
        End If
        If (fCmdRet = 0) Then
            fComAdr = aNewComAdr
            returninfo = returninfo + setinfo + "Address success"
        Else
            returninfo = returninfo + setinfo + "Address failed"
       '     returninfoDlg = returninfoDlg + setinfo + "Address Fail Command Response=0x" + Cstr(fCmdRet) + "(" + GetReturnCodeDesc(fCmdRet) + ")"
        End If
        fCmdRet = SetPowerDbm(ComAdr, PowerDbm, FrmHabdle)
        If (fCmdRet = 0) Then
            returninfo = returninfo + ",Power success"
        Else
            returninfo = returninfo + ",Power failed"
         '   returninfoDlg = returninfoDlg + " " + setinfo + "Power Fail Command Response=0x" + Convert.ToString(fCmdRet) + "(" + GetReturnCodeDesc(fCmdRet) + ")"
        End If

        fCmdRet = Writedfre(ComAdr, dmaxfre, dminfre, FrmHabdle)
        If (fCmdRet = 0) Then
            returninfo = returninfo + ",Frequen success"
        Else

            returninfo = returninfo + ",Frequen failed"
         '   returninfoDlg = returninfoDlg + " " + setinfo + "Frequency Fail Command Response=0x" + Convert.ToString(fCmdRet) + "(" + GetReturnCodeDesc(fCmdRet) + ")"
        End If

        fCmdRet = Writebaud(ComAdr, fBaud, FrmHabdle)
        If (fCmdRet = 0) Then
            returninfo = returninfo + ",BaudRate success"
        Else

            returninfo = returninfo + ",BaudRate failed"
           ' returninfoDlg = returninfoDlg + " " + setinfo + "Baud Rate Fail Command Response=0x" + Convert.ToString(fCmdRet) + "(" + GetReturnCodeDesc(fCmdRet) + ")"
        End If

        fCmdRet = WriteScanTime(ComAdr, ScanTime, FrmHabdle)
        If (fCmdRet = 0) Then
            returninfo = returninfo + ",ScanTime success"
        Else
            returninfo = returninfo + ",ScanTime failed"
          '  returninfoDlg = returninfoDlg + " " + setinfo + "InventoryScanTime Fail Command Response=0x" + Convert.ToString(fCmdRet) + "(" + GetReturnCodeDesc(fCmdRet) + ")"
        End If
        Label18.Caption = returninfo
End Sub

Private Sub Command8_Click()
Dim Parameter(6) As Byte
Parameter(0) = CByte(Combo8.ListIndex)
Parameter(1) = 2
Parameter(2) = 1
Parameter(3) = 0
Parameter(4) = 1
Parameter(5) = 0
fCmdRet = SetWorkMode(ComAdr, Parameter(0), FrmHabdle)
If (fCmdRet = 0) Then
Label18.Caption = "Set mode success!"
Else
Label18.Caption = "Set mode failed!"
End If
End Sub

Private Sub Command9_Click()
Dim Parameter(11) As Byte
fCmdRet = GetWorkModeParameter(ComAdr, Parameter(0), FrmHabdle)
If (fCmdRet = 0) Then
Combo8.ListIndex = Parameter(4)
Label18.Caption = "Get mode success!"
Else
Label18.Caption = "Get mode failed!"
End If
End Sub

Private Sub Form_Load()
Dim i As Integer
Dim str As String
Option1.Value = True
For i = 1 To 9
str = Val(i)
Combo1.AddItem ("COM" + str)
Next i
Combo1.ListIndex = 0
Combo2.AddItem ("9600bps")
Combo2.AddItem ("19200bps")
Combo2.AddItem ("38400bps")
Combo2.AddItem ("57600bps")
Combo2.AddItem ("115200bps")
Combo2.ListIndex = 3
Combo3.AddItem ("9600bps")
Combo3.AddItem ("19200bps")
Combo3.AddItem ("38400bps")
Combo3.AddItem ("57600bps")
Combo3.AddItem ("115200bps")
Combo3.ListIndex = 3
 For i = 3 To 255
 str = Val(i)
  Combo5.AddItem (str + "*100ms")
Next i
  Combo5.ListIndex = 7
  
 For i = 0 To 62
    Combo6.AddItem (CStr(902.6 + i * 0.4) + " MHz")
    Combo7.AddItem (CStr(902.6 + i * 0.4) + "MHz")
 Next i
  Combo6.ListIndex = 0
  Combo7.ListIndex = 62
  Combo4.ListIndex = 30
  fIsInventoryScan = False
  fcloseApp = False
  Combo8.ListIndex = 0
  Combo10.ListIndex = 1
End Sub

Private Sub Form_Unload(Cancel As Integer)
fcloseApp = True
End Sub

Private Sub Option1_Click()
Dim i As Integer
  Combo6.Clear
  Combo7.Clear
  Check3.Value = 0
 For i = 0 To 62
    Combo6.AddItem (CStr(902.6 + i * 0.4) + " MHz")
    Combo7.AddItem (CStr(902.6 + i * 0.4) + " MHz")
 Next i
  Combo6.ListIndex = 0
  Combo7.ListIndex = 62
End Sub

Private Sub Option2_Click()
  Dim i As Integer
  Combo6.Clear
  Combo7.Clear
  Check3.Value = 0
  For i = 0 To 19
    Combo6.AddItem (CStr(920.125 + i * 0.25) + " MHz")
    Combo7.AddItem (CStr(920.125 + i * 0.25) + " MHz")
  Next i
  Combo6.ListIndex = 0
  Combo7.ListIndex = 19
End Sub

Private Sub Option3_Click()
  Dim i As Integer
  Combo6.Clear
  Combo7.Clear
  Check3.Value = 0
  For i = 0 To 49
    Combo6.AddItem (CStr(902.75 + i * 0.5) + " MHz")
    Combo7.AddItem (CStr(902.75 + i * 0.5) + " MHz")
  Next i
  Combo6.ListIndex = 0
  Combo7.ListIndex = 49
End Sub

Private Sub Option4_Click()
 Dim i As Integer
  Combo6.Clear
  Combo7.Clear
  Check3.Value = 0
  For i = 0 To 31
    Combo6.AddItem (CStr(917.1 + i * 0.2) + " MHz")
    Combo7.AddItem (CStr(917.1 + i * 0.2) + " MHz")
  Next i
  Combo6.ListIndex = 0
  Combo7.ListIndex = 31

End Sub

Private Sub Option5_Click()
 Dim i As Integer
  Combo6.Clear
  Combo7.Clear
  Check3.Value = 0
  For i = 0 To 14
    Combo6.AddItem (CStr(865.1 + i * 0.2) + " MHz")
    Combo7.AddItem (CStr(865.1 + i * 0.2) + " MHz")
  Next i
  Combo7.ListIndex = 14
  Combo6.ListIndex = 0
End Sub

Private Sub Option6_Click()
    If (FrmHabdle > 1023) Then
     Timer1.Enabled = False
      If (FrmHabdle > 1023) Then
        fCmdRet = CloseNetPort(FrmHabdle)
     End If
     If fCmdRet = 0 Then
        Label18.Caption = "Close success!"
        Label18.Caption = ""
        Text2.Text = ""
        Text3.Text = ""
        Text4.Text = ""
        Text5.Text = ""
        Text6.Text = ""
        Text7.Text = ""
        Text9.Text = ""
        Check1.Value = 0
        Check2.Value = 0
        Command3.Enabled = False
        Command4.Enabled = False
        Command5.Enabled = False
        Command7.Enabled = False
        Command8.Enabled = False
        Command9.Enabled = False
        Command10.Enabled = False
        Command11.Enabled = False
     Else
        Label18.Caption = "Close failed!"
     End If
    End If
    Command12.Enabled = False
    Command13.Enabled = False
    Command1.Enabled = True
    Command2.Enabled = True
End Sub

Private Sub Option7_Click()
 If ((FrmHabdle > 0) And (FrmHabdle < 256)) Then
        Timer1.Enabled = False
        fCmdRet = CloseComPort()
        If fCmdRet = 0 Then
        Label18.Caption = "Close success!"
        Label18.Caption = ""
        Text2.Text = ""
        Text3.Text = ""
        Text4.Text = ""
        Text5.Text = ""
        Text6.Text = ""
        Text7.Text = ""
        Text9.Text = ""
        Check1.Value = 0
        Check2.Value = 0
        Command3.Enabled = False
        Command4.Enabled = False
        Command5.Enabled = False
        Command7.Enabled = False
        Command8.Enabled = False
        Command9.Enabled = False
        Command10.Enabled = False
        Command11.Enabled = False
        Else
        Label18.Caption = "Close failed!"
        End If
    End If
    Command12.Enabled = True
    Command13.Enabled = True
    Command1.Enabled = False
    Command2.Enabled = False
End Sub

Private Sub Text10_KeyPress(KeyAscii As Integer)
Dim L  As Boolean
L = (KeyAscii < 8) Or (KeyAscii > 8) And (KeyAscii < 48) Or (KeyAscii > 57) And (KeyAscii < 65) Or (KeyAscii > 70) And (KeyAscii < 97) Or (KeyAscii > 102)
If L Then
KeyAscii = 0
End If
If ((KeyAscii > 96) And (KeyAscii < 103)) Then
KeyAscii = KeyAscii - 32
End If
End Sub

Private Sub Text11_KeyPress(KeyAscii As Integer)
Dim L  As Boolean
L = (KeyAscii < 8) Or (KeyAscii > 8) And (KeyAscii < 48) Or (KeyAscii > 57) And (KeyAscii < 65) Or (KeyAscii > 70) And (KeyAscii < 97) Or (KeyAscii > 102)
If L Then
KeyAscii = 0
End If
If ((KeyAscii > 96) And (KeyAscii < 103)) Then
KeyAscii = KeyAscii - 32
End If
End Sub

Private Sub Text12_KeyPress(KeyAscii As Integer)
Dim L  As Boolean
L = (KeyAscii < 8) Or (KeyAscii > 8) And (KeyAscii < 48) Or (KeyAscii > 57) And (KeyAscii < 65) Or (KeyAscii > 70) And (KeyAscii < 97) Or (KeyAscii > 102)
If L Then
KeyAscii = 0
End If
If ((KeyAscii > 96) And (KeyAscii < 103)) Then
KeyAscii = KeyAscii - 32
End If
End Sub

Private Sub Text13_KeyPress(KeyAscii As Integer)
Dim L  As Boolean
L = (KeyAscii < 8) Or (KeyAscii > 8) And (KeyAscii < 48) Or (KeyAscii > 57) And (KeyAscii < 65) Or (KeyAscii > 70) And (KeyAscii < 97) Or (KeyAscii > 102)
If L Then
KeyAscii = 0
End If
If ((KeyAscii > 96) And (KeyAscii < 103)) Then
KeyAscii = KeyAscii - 32
End If
End Sub

Private Sub Text8_KeyPress(KeyAscii As Integer)
Dim L  As Boolean
L = (KeyAscii < 8) Or (KeyAscii > 8) And (KeyAscii < 48) Or (KeyAscii > 57) And (KeyAscii < 65) Or (KeyAscii > 70) And (KeyAscii < 97) Or (KeyAscii > 102)
If L Then
KeyAscii = 0
End If
If ((KeyAscii > 96) And (KeyAscii < 103)) Then
KeyAscii = KeyAscii - 32
End If
End Sub

Private Sub Timer1_Timer()
Dim i As Long
If (fIsInventoryScan) Then
Exit Sub
End If
fIsInventoryScan = True
b_flag = Inventory()
fIsInventoryScan = False
End Sub
