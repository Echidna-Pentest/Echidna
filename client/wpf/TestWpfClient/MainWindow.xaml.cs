using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Navigation;
using System.Windows.Shapes;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Collections.ObjectModel;
using System.ComponentModel;            // for INotifyPropertyChanged
using System.Runtime.CompilerServices;  // for [CallerMemberName]
using System.Net.WebSockets;
using System.Threading;
using Microsoft.VisualBasic;    // for dialog InputBox
using System.Text.RegularExpressions;
using System.IO;    // for StreamWriter/StreamReader

namespace TestWpfClient
{
    /// <summary>
    /// Interaction logic for MainWindow.xaml
    /// </summary>
    public partial class MainWindow : Window
    {
        private static readonly string _settingsFileName = "./settings.json";
        private static string _serverIp = "xxx.xxx.xxx.xxx";
        private static string _httpPort = "8888";
        private static string _webSocketPort = "8889";

        private static string _baseUrl = $"http://{_serverIp}:{_httpPort}";
        private static HttpClient _client;

        private static string _webSocketUri = $"ws://{_serverIp}:{_webSocketPort}";

        private void SettingsServerIP_Click(object sender, RoutedEventArgs e)
        {
            string input = Interaction.InputBox("Enter the IP address of the Echidna server.", "Settings : Echidna server", _serverIp);
            if (string.IsNullOrWhiteSpace(input))
            {
                return;
            }
            _serverIp = input.Trim();
            ChangeServer();
        }

        private void SettingsServerHTTP_Click(object sender, RoutedEventArgs e)
        {
            string input = Interaction.InputBox("Enter the HTTP port number of the Echidna server.", "Settings : Echidna server", _httpPort);
            if (string.IsNullOrWhiteSpace(input))
            {
                return;
            }
            _httpPort = input.Trim();
            ChangeServer();
        }

        private void SettingsServerWebSocket_Click(object sender, RoutedEventArgs e)
        {
            string input = Interaction.InputBox("Enter the WebSocket port number of the Echidna server.", "Settings : Echidna server", _webSocketPort);
            if (string.IsNullOrWhiteSpace(input))
            {
                return;
            }
            _webSocketPort = input.Trim();
            ChangeServer();
        }

        private void ChangeServer()
        {
            MessageBoxResult result = MessageBox.Show("Do you want to connect to the Echidna server?\n" +
                "Now settings are ...\n" +
                $"  IP address : {_serverIp}\n" +
                $"  HTTP port : {_httpPort}\n" +
                $"  WebSocket port : {_webSocketPort}",
                "Connect to Echidna server", MessageBoxButton.OKCancel, MessageBoxImage.Asterisk);
            if (result == MessageBoxResult.OK)
            {
                SaveSettings();
                InitServer();
            }
        }

        private void InitServer()
        {
            if (!Regex.IsMatch(_serverIp, "^((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\\.){3}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])$") ||
                !Regex.IsMatch(_httpPort, "^[1-9]+[0-9]*$") ||
                !Regex.IsMatch(_webSocketPort, "^[1-9]+[0-9]*$"))
            {
                MessageBoxResult result = MessageBox.Show("You must set the correct IP address and port number for the Echidna server in the Settings menu.\n" +
                    "Now settings are ...\n" +
                    $"  IP address : {_serverIp}\n" +
                    $"  HTTP port : {_httpPort}\n" +
                    $"  WebSocket port : {_webSocketPort}",
                    "Echidna", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }
            _client = new();
            _baseUrl = $"http://{_serverIp}:{_httpPort}";
            _webSocketUri = $"ws://{_serverIp}:{_webSocketPort}";
            _ = runWebSocket();
            _ = InitTargets();
            _ = InitTerminals();
        }

        private void LoadSettings()
        {
            if (!File.Exists(_settingsFileName))
            {
                return;
            }
            StreamReader streamReader = new StreamReader(_settingsFileName, Encoding.UTF8);
            string json = streamReader.ReadToEnd();
            Settings settings = JsonSerializer.Deserialize<Settings>(json);
            _serverIp = settings.ServerIp;
            _httpPort = settings.HttpPort;
            _webSocketPort = settings.WebSocketPort;
        }

        private void SaveSettings()
        {
            Settings settings = new();
            settings.ServerIp = _serverIp;
            settings.HttpPort = _httpPort;
            settings.WebSocketPort = _webSocketPort;
            string json = JsonSerializer.Serialize(settings);
            StreamWriter streamWriter = new StreamWriter(_settingsFileName, true, Encoding.UTF8);
            streamWriter.WriteLine(json);
            streamWriter.Close();
        }

        /// <summary>
        /// Setting data
        /// </summary>
        private class Settings
        {
            public string ServerIp { get; set; }
            public string HttpPort { get; set; }
            public string WebSocketPort { get; set; }
        }


        /// <summary>
        /// Target data
        /// </summary>
        private class Target
        {
            public int id { get; set; }
            public string value { get; set; }
            public int parent { get; set; }
            public List<int> children { get; set; }
        }

        /// <summary>
        /// TargetItem data
        /// </summary>
        private class TargetItem
        {
            /// <summary>
            /// TargetItem data list
            /// </summary>
            private static List<TargetItem> Targets { get; set; } = new List<TargetItem>();

            public static TargetItem SetTargets(List<Target> targets)
            {
                SetData(targets);
                SetHierarchy();
                if (Targets.Count == 0)
                {
                    return null;
                }
                return Targets[0];
            }

            // Create TargetItems
            private static void SetData(List<Target> targets)
            {
                for (int i = 0; i < targets.Count; i++)
                {
                    Target target = targets[i];
                    if (target == null)
                    {
                        if (i >= Targets.Count)
                        {
                            Targets.Add(null);
                        }
                        else
                        {
                            Targets[i] = null;
                        }
                        continue;
                    }
                    if (i >= Targets.Count || Targets[i] == null)
                    {
                        TargetItem targetItem = new TargetItem(target);
                        Targets.Add(targetItem);
                    }
                    else
                    {
                        Targets[i].Init(target);
                    }
                }
            }

            // Set TargetItems children
            private static void SetHierarchy()
            {
                for (int i = 0; i < Targets.Count; i++)
                {
                    if (Targets[i] == null)
                    {
                        continue;
                    }
                    TargetItem targetItem = Targets[i];
                    if (targetItem.Id != 0)
                    {
                        targetItem.Parent = Targets[targetItem.Base.parent];
                    }
                    for (int j = 0; j < targetItem.Base.children.Count; j++)
                    {
                        targetItem.Children.Add(Targets[targetItem.Base.children[j]]);
                    }
                }
            }

            private Target Base { get; set; }
            public int Id { get; set; }
            public string Value { get; set; }
            public TargetItem Parent { get; set; }
            public List<TargetItem> Children { get; set; }
            public bool IsExpanded { get; set; }
            public bool IsSelected { get; set; }

            public TargetItem(Target target)
            {
                Init(target);
            }

            public void Init(Target target)
            {
                Base = target;
                Id = target.id;
                Value = target.value;
                Parent = null;
                Children = new List<TargetItem>();
            }
        }

        /// <summary>
        /// TargetItem data collection
        /// </summary>
        private ObservableCollection<TargetItem> TargetItems { get; set; } = new ObservableCollection<TargetItem>();

        /// <summary>
        /// Terminal data
        /// </summary>
        private class Terminal
        {
            public int id { get; set; }
            public string name { get; set; }
        }

        /// <summary>
        /// Log data
        /// </summary>
        private class Log
        {
            public int id { get; set; }
            public string command { get; set; }
            public int status { get; set; }
            public string output { get; set; }
        }

        /// <summary>
        /// Command receipt data
        /// </summary>
        private class CommandReceipt
        {
            public int receipt { get; set; }
        }

        class TerminalTabItem : INotifyPropertyChanged
        {
            /// <summary>
            /// Property change event
            /// </summary>
            public event PropertyChangedEventHandler PropertyChanged;
            private void NotifyPropertyChanged([CallerMemberName] String propertyName = "")
            {
                PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
            }

            /// <summary>
            /// Terminal ID
            /// </summary>
            public int Id { get; set; }

            /// <summary>
            /// Tab header
            /// </summary>
            public string Header { get; set; }

            /// <summary>
            /// Tab Contents
            /// </summary>
            private string _Content = "";
            public string Content
            {
                get => _Content;
                set
                {
                    if (value == _Content) return;
                    _Content = value;
                    NotifyPropertyChanged();
                }
            }
        }

        /// <summary>
        /// TabItem data collection
        /// </summary>
        private ObservableCollection<TerminalTabItem> TerminalTabItems { get; set; } = new ObservableCollection<TerminalTabItem>();

        private bool TerminalOperating;

        public MainWindow()
        {
            InitializeComponent();
            LoadSettings();
            InitServer();
        }

        private async Task runWebSocket()
        {
            ClientWebSocket wsClient = new();
            Uri uri = new(_webSocketUri);
            await wsClient.ConnectAsync(uri, CancellationToken.None);
            var buffer = new byte[1024];
            while (true)
            {
                var segment = new ArraySegment<byte>(buffer);
                var result = await wsClient.ReceiveAsync(segment, CancellationToken.None);
                if (result.MessageType == WebSocketMessageType.Close)
                {
                    await wsClient.CloseAsync(WebSocketCloseStatus.NormalClosure, "OK", CancellationToken.None);
                    return;
                }
                if (result.MessageType != WebSocketMessageType.Text)
                {
                    continue;
                }
                int count = result.Count;
                while (!result.EndOfMessage)
                {
                    if (count >= buffer.Length)
                    {
                        System.Diagnostics.Debug.Print("ERROR : WebSocket message buffer overflow!");
                        continue;
                    }
                    segment = new ArraySegment<byte>(buffer, count, buffer.Length - count);
                    result = await wsClient.ReceiveAsync(segment, CancellationToken.None);
                    count += result.Count;
                }
                var message = Encoding.UTF8.GetString(buffer, 0, count);
                await NotificationDispatch(message);
            }
        }

        private async Task NotificationDispatch(string message)
        {
            var objMessage = JsonSerializer.Deserialize<Dictionary<string, object>>(message);
            if (!objMessage.ContainsKey("type")) {
                return;
            }
            string type = objMessage["type"].ToString();
            switch (type)
            {
                case "terminals":
                    if (!TerminalOperating)
                    {
                        await UpdateTerminals();
                        System.Diagnostics.Debug.Print("Change TERMINALS");
                    }
                    break;
                case "logs":
                    if (!TerminalOperating && tabControl.SelectedIndex >= 0)
                    {
                        string selectedId = TerminalTabItems[tabControl.SelectedIndex].Id.ToString();
                        string notifiedId = objMessage.ContainsKey("terminalId") ? objMessage["terminalId"].ToString() : selectedId;
                        if (notifiedId.Equals(selectedId))
                        {
                            await UpdateTerminalLogs();
                            System.Diagnostics.Debug.Print("Change LOGS");
                        }
                    }
                    break;
                case "targets":
                    await UpdateTargets();
                    System.Diagnostics.Debug.Print("Change TARGETS");
                    break;
                default:
                    break;
            }
        }

        private async Task InitTargets()
        {
           await UpdateTargets();
        }

        private async Task UpdateTargets()
        {
            HttpResponseMessage response = await _client.GetAsync(_baseUrl + "/targets");
            var contents = await response.Content.ReadAsStringAsync();
            List<Target> results = JsonSerializer.Deserialize<List<Target>>(contents);
            TargetItem targetItem = TargetItem.SetTargets(results);
            TargetItems.Clear();
            TargetItems.Add(targetItem);
            treeView.ItemsSource = TargetItems;
        }

        // Manual refreshing of all targets in the TargetTreeView context menu
        private void tvTargetAllReplace_Click(object sender, RoutedEventArgs e)
        {
            _ = UpdateTargets();
        }

        private void tvTargetValueCopy_Click(object sender, RoutedEventArgs e)
        {
            var target = (TargetItem)treeView.SelectedItem;
            Clipboard.SetData(DataFormats.Text, target.Value);
        }

        private int GetSelectedTargetId()
        {
            var target = (TargetItem)treeView.SelectedItem;
            return target == null ? 0 : target.Id;
        }

        private async Task InitTerminals()
        {
            TerminalOperating = false;
            await UpdateTerminals();
            tbxTermName.Focus();
        }

        private async Task UpdateTerminals(int selectTermId = 0)
        {
            if (selectTermId <= 0 && tabControl.SelectedIndex >= 0)
            {
                selectTermId = TerminalTabItems[tabControl.SelectedIndex].Id;
            }
            int selectTabIndex = -1;
            HttpResponseMessage response = await _client.GetAsync(_baseUrl + "/terminals");
            var contents = await response.Content.ReadAsStringAsync();
            var results = new List<Terminal>();
            results = JsonSerializer.Deserialize<List<Terminal>>(contents);
            TerminalTabItems.Clear();
            for (var i = 0; i < results.Count; i++)
            {
                var res = results[i];
                TerminalTabItems.Add(new TerminalTabItem { Id = res.id, Header = res.name, Content = "" });
                if (res.id == selectTermId)
                {
                    selectTabIndex = TerminalTabItems.Count - 1;
                } 
            }
            tabControl.ItemsSource = TerminalTabItems;
            tabControl.SelectedIndex = selectTabIndex;
        }


        // Terminal add
        private void button_Click(object sender, RoutedEventArgs e)
        {
            _ = addTerminal(tbxTermName.Text);
        }

        private void TbxTermName_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Return)
            {
                _ = addTerminal(tbxTermName.Text);
            }
        }

        private async Task addTerminal(string termName)
        {
            TerminalOperating = true;
            if (string.IsNullOrWhiteSpace(termName))
            {
                return;
            }
            var parameters = new Dictionary<string, string>()
            {
                { "name", termName },
            };
            var inputs = new FormUrlEncodedContent(parameters);
            HttpResponseMessage response = await _client.PostAsync(_baseUrl + "/terminals", inputs);
            var contents = await response.Content.ReadAsStringAsync();
            var newTerminal = JsonSerializer.Deserialize<Terminal>(contents);
            await UpdateTerminals(newTerminal.id);
            await UpdateTerminalLogs();
            tbxTermName.Text = "";
            tbxCommand.Focus();
            TerminalOperating = false;
        }

        private void button1_Click(object sender, RoutedEventArgs e)
        {
            _ = deleteTerminal();
        }

        private async Task deleteTerminal()
        {
            TerminalOperating = true;
            var tabIndex = tabControl.SelectedIndex;
            if (tabIndex >= 0)
            {
                var currentTab = TerminalTabItems[tabIndex];
                var termId = currentTab.Id;
                HttpResponseMessage response = await _client.DeleteAsync(_baseUrl + $"/terminals/{termId}");
                await UpdateTerminals();
            }
            TerminalOperating = false;
        }

        private void button2_Click(object sender, RoutedEventArgs e)
        {
            _ = UpdateTerminals();
            _ = UpdateTerminalLogs();
            _ = UpdateTargets();
        }

        private void TabControl_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            _ = UpdateTerminalLogs();
            tbxCommand.Focus();
        }

        private async Task UpdateTerminalLogs()
        {
            if (tabControl.SelectedIndex >= 0)
            {
                var log = await getAllLog(TerminalTabItems[tabControl.SelectedIndex].Id);
                TerminalTabItems[tabControl.SelectedIndex].Content = log;
                LogScrollToBottom();
            }
        }

        private void LogScrollToBottom()
        {
            ContentPresenter cpCurrentTab = (ContentPresenter)tabControl.Template.FindName("PART_SelectedContentHost", tabControl);
            if (cpCurrentTab != null &&
                cpCurrentTab.ContentTemplate == tabControl.ContentTemplate)
            {
                _ = cpCurrentTab.ApplyTemplate();
                ScrollViewer scrollViewer = (ScrollViewer)cpCurrentTab.ContentTemplate.FindName("svwLog", cpCurrentTab);
                if (scrollViewer != null)
                {
                    scrollViewer.ScrollToBottom();
                    TextBox tbxLog = (TextBox)scrollViewer.FindName("tbxLog");
                    tbxLog.ScrollToEnd();
                }
            }
        }

        private async Task<string> getAllLog(int termId)
        {
            HttpResponseMessage response = await _client.GetAsync(_baseUrl + $"/logs/terminals/{termId}");
            var contents = await response.Content.ReadAsStringAsync();
            var results = JsonSerializer.Deserialize<List<Log>>(contents);
            var log = "";
            for (var i = 0; i < results.Count; i++)
            {
                var res = results[i];
                log += res.output;
            }
            return log;
        }

        private void TbxCtrlC_Click(object sender, RoutedEventArgs e)
        {
            _ = SendSpecialKeyCode("\x03");

        }

        private async Task SendSpecialKeyCode(string strKeyCode)
        {
            var tabIndex = tabControl.SelectedIndex;
            if (tabIndex >= 0)
            {
                var currentTab = TerminalTabItems[tabIndex];
                var parameters = new Dictionary<string, object>()
                {
                    { "keycode", strKeyCode },
                };
                var jsonStr = JsonSerializer.Serialize(parameters);
                var inputs = new StringContent(jsonStr, Encoding.UTF8, "application/json");
                HttpResponseMessage response = await _client.PutAsync(_baseUrl + $"/terminals/{currentTab.Id}/shell", inputs);
                var contents = await response.Content.ReadAsStringAsync();
                var result = JsonSerializer.Deserialize<CommandReceipt>(contents);
            }
        }

        private void btnExec_Click(object sender, RoutedEventArgs e)
        {
            _ = executeCommand(tbxCommand.Text);

        }

        private void TbxCommand_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Return)
            {
                _ = executeCommand(tbxCommand.Text);
            }
        }

        private async Task executeCommand(string command)
        {
            var tabIndex = tabControl.SelectedIndex;
            if (tabIndex >= 0)
            {
                var currentTab = TerminalTabItems[tabIndex];
                var targetId = GetSelectedTargetId();
                var parameters = new Dictionary<string, object>()
                {
                    { "command", command + "\n" },
                    { "target", targetId }
                };
                var jsonStr = JsonSerializer.Serialize(parameters);
                var inputs = new StringContent(jsonStr, Encoding.UTF8, "application/json");
                HttpResponseMessage response = await _client.PostAsync(_baseUrl + $"/terminals/{currentTab.Id}/shell", inputs);
                var contents = await response.Content.ReadAsStringAsync();
                var result = JsonSerializer.Deserialize<CommandReceipt>(contents);
                if (result.receipt > 0)
                {
                    tbxCommand.Text = "";
                }
            }
        }
    }
}
