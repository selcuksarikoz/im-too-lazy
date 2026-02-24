class User:
    _name: str

    def __init__(self, name: str, age: int, email: str):
        self._name = name
        self._age = age
        self._email = email
        self._is_active = True


class Team:
    _title: str

    def __init__(self):
        self._title = "core"
        self._member_count = 3


class Workspace:
    def __init__(self, slug: str):
        self._slug = slug
        self._region = "eu"
