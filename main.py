import sys
from PyQt5.QtCore import QUrl, Qt, QSize
from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QHBoxLayout, QVBoxLayout, 
    QPushButton, QLineEdit, QListWidget, QStackedWidget, QListWidgetItem,
    QLabel, QFrame, QSizePolicy
)
from PyQt5.QtGui import QIcon, QFont
from PyQt5.QtWebEngineWidgets import QWebEngineView

# --- QSS Styling ---
STYLESHEET = """
QMainWindow {
    background-color: #171717; /* Very dark background */
}
#sidebar {
    background-color: #171717;
    border-right: 1px solid #2A2A2A;
}
#content_area {
    background-color: #171717;
}
QPushButton {
    background-color: transparent;
    color: #A0A0A0;
    border-radius: 6px;
    padding: 8px;
    font-size: 14px;
    font-weight: bold;
}
QPushButton:hover {
    background-color: #2A2A2A;
    color: #FFFFFF;
}
QLineEdit {
    background-color: #2A2A2A;
    color: #FFFFFF;
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 13px;
    border: none;
    margin-bottom: 15px;
}
QLineEdit:focus {
    background-color: #333333;
    border: 1px solid #555555;
}
QListWidget {
    background-color: transparent;
    border: none;
    outline: none;
}
QListWidget::item {
    color: #A0A0A0;
    padding: 10px;
    border-radius: 8px;
    margin-bottom: 4px;
}
QListWidget::item:hover {
    background-color: #2A2A2A;
    color: #FFFFFF;
}
QListWidget::item:selected {
    background-color: #3A3A3A;
    color: #FFFFFF;
    font-weight: bold;
}
QLabel#title {
    color: #FFFFFF;
    font-size: 18px;
    font-weight: bold;
    padding-bottom: 15px;
}
"""

class MainWindow(QMainWindow):
    def __init__(self):
        super(MainWindow, self).__init__()
        self.setWindowTitle("Zen Browser Prototype")
        self.setGeometry(100, 100, 1300, 850)
        
        # Main Layout: HBox separating Sidebar and Content
        self.central_widget = QWidget()
        self.setCentralWidget(self.central_widget)
        self.main_layout = QHBoxLayout(self.central_widget)
        self.main_layout.setContentsMargins(0, 0, 0, 0)
        self.main_layout.setSpacing(0)

        # --- Sidebar ---
        self.sidebar = QFrame()
        self.sidebar.setObjectName("sidebar")
        self.sidebar.setFixedWidth(280)
        self.sidebar_layout = QVBoxLayout(self.sidebar)
        self.sidebar_layout.setContentsMargins(20, 30, 20, 20)
        
        # Title/Logo
        self.app_title = QLabel("Zen Browser")
        self.app_title.setObjectName("title")
        self.sidebar_layout.addWidget(self.app_title)

        # Nav Buttons Layout
        self.nav_layout = QHBoxLayout()
        self.back_btn = QPushButton("◀")
        self.forward_btn = QPushButton("▶")
        self.reload_btn = QPushButton("↻")
        self.new_tab_btn = QPushButton("+")
        
        # Tooltips
        self.back_btn.setToolTip("Back")
        self.forward_btn.setToolTip("Forward")
        self.reload_btn.setToolTip("Reload")
        self.new_tab_btn.setToolTip("New Tab")

        self.nav_layout.addWidget(self.back_btn)
        self.nav_layout.addWidget(self.forward_btn)
        self.nav_layout.addWidget(self.reload_btn)
        self.nav_layout.addStretch()
        self.nav_layout.addWidget(self.new_tab_btn)
        self.sidebar_layout.addLayout(self.nav_layout)

        # URL Bar
        self.url_bar = QLineEdit()
        self.url_bar.setPlaceholderText("Search or enter address")
        self.sidebar_layout.addWidget(self.url_bar)

        # Tabs List
        self.tabs_list = QListWidget()
        self.sidebar_layout.addWidget(self.tabs_list)

        self.main_layout.addWidget(self.sidebar)

        # --- Main Content Area ---
        self.content_container = QFrame()
        self.content_container.setObjectName("content_area")
        self.content_layout = QVBoxLayout(self.content_container)
        
        # Adding a margin to create a "floating" effect for the web view
        self.content_layout.setContentsMargins(0, 10, 10, 10) 
        
        # Stacked widget holds all QWebEngineViews
        self.stacked_widget = QStackedWidget()
        self.content_layout.addWidget(self.stacked_widget)
        
        self.main_layout.addWidget(self.content_container)

        # Apply Global Style
        self.setStyleSheet(STYLESHEET)

        # Connections
        self.back_btn.clicked.connect(self.navigate_back)
        self.forward_btn.clicked.connect(self.navigate_forward)
        self.reload_btn.clicked.connect(self.reload_page)
        self.new_tab_btn.clicked.connect(lambda: self.add_new_tab("https://www.google.com", "New Tab"))
        self.url_bar.returnPressed.connect(self.navigate_to_url)
        self.tabs_list.currentRowChanged.connect(self.switch_tab)

        # Track browsers
        self.browsers = []

        # Start with one tab
        self.add_new_tab("https://www.google.com", "Google")

    def add_new_tab(self, url, label):
        browser = QWebEngineView()
        browser.setUrl(QUrl(url))
        
        # Listen for URL/Title changes to update Sidebar
        browser.urlChanged.connect(lambda qurl, b=browser: self.update_url_bar(qurl, b))
        browser.titleChanged.connect(lambda title, b=browser: self.update_tab_title(title, b))

        self.stacked_widget.addWidget(browser)
        self.browsers.append(browser)
        
        item = QListWidgetItem(label)
        self.tabs_list.addItem(item)
        
        # Switch to new tab
        index = len(self.browsers) - 1
        self.tabs_list.setCurrentRow(index)

    def current_browser(self):
        index = self.stacked_widget.currentIndex()
        if index >= 0 and index < len(self.browsers):
            return self.browsers[index]
        return None

    def switch_tab(self, index):
        if index >= 0:
            self.stacked_widget.setCurrentIndex(index)
            # Update URL bar to match current tab
            browser = self.current_browser()
            if browser:
                self.url_bar.setText(browser.url().toString())
                self.url_bar.setCursorPosition(0)

    def navigate_to_url(self):
        url = self.url_bar.text()
        if not url.startswith('http'):
            # Basic Google Search fallback
            if '.' not in url.split(' ')[0]:
                url = 'https://www.google.com/search?q=' + url
            else:
                url = 'http://' + url
        browser = self.current_browser()
        if browser:
            browser.setUrl(QUrl(url))

    def update_url_bar(self, qurl, browser):
        if browser == self.current_browser():
            self.url_bar.setText(qurl.toString())
            self.url_bar.setCursorPosition(0)

    def update_tab_title(self, title, browser):
        try:
            index = self.browsers.index(browser)
            item = self.tabs_list.item(index)
            if item:
                # Limit title length for the sidebar
                short_title = (title[:25] + '...') if len(title) > 25 else title
                item.setText(short_title)
        except ValueError:
            pass

    def navigate_back(self):
        b = self.current_browser()
        if b: b.back()

    def navigate_forward(self):
        b = self.current_browser()
        if b: b.forward()

    def reload_page(self):
        b = self.current_browser()
        if b: b.reload()

if __name__ == '__main__':
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec_())
