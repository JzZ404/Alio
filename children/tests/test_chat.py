import json
import os
import pytest


@pytest.fixture(autouse=True)
def tmp_working_dir(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)


def test_load_chat_history_returns_empty_when_missing():
    from children.chat import load_chat_history
    assert load_chat_history() == []


def test_load_chat_history_returns_saved_entries():
    from children.chat import load_chat_history
    data = [{"role": "user", "content": "hello"}, {"role": "model", "content": "hi"}]
    with open("chat_history.json", "w") as f:
        json.dump(data, f)
    assert load_chat_history() == data


def test_load_chat_history_returns_empty_on_malformed_json():
    from children.chat import load_chat_history
    with open("chat_history.json", "w") as f:
        f.write("not json{{{")
    assert load_chat_history() == []


def test_save_chat_history_creates_file():
    from children.chat import save_chat_history
    history = [{"role": "user", "content": "hello"}, {"role": "model", "content": "hi"}]
    save_chat_history(history)
    assert os.path.exists("chat_history.json")
    with open("chat_history.json") as f:
        assert json.load(f) == history


def test_save_chat_history_overwrites_existing():
    from children.chat import save_chat_history
    save_chat_history([{"role": "user", "content": "first"}])
    save_chat_history([{"role": "user", "content": "second"}])
    with open("chat_history.json") as f:
        data = json.load(f)
    assert len(data) == 1
    assert data[0]["content"] == "second"
